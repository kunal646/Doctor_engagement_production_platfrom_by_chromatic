import JSZip from "jszip";

import { REQUEST_FORM_FIELDS } from "@/config/request-form";

const GEMINI_MODEL = "gemini-2.5-flash";
const MIN_EXTRACTED_TEXT_LENGTH = 200;

type GeminiInlinePart = {
  inline_data: {
    mime_type: string;
    data: string;
  };
};

export interface ResumeAutofillResult {
  values: Record<string, string>;
  suggestedKeys: string[];
  warnings: string[];
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x2013;/gi, "-")
    .replace(/&#x2014;/gi, "-")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\n")
    .replace(/&#9;/g, "\t")
    .replace(/&#160;/g, " ");
}

function xmlToText(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br[^>]*\/>/g, "\n")
      .replace(/<\/w:p>/g, "\n")
      .replace(/<\/w:tr>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function guessMimeType(fileName: string, providedType?: string) {
  if (providedType) {
    return providedType;
  }

  const normalized = fileName.toLowerCase();

  if (normalized.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (normalized.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (normalized.endsWith(".txt")) {
    return "text/plain";
  }
  if (normalized.endsWith(".png")) {
    return "image/png";
  }
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (normalized.endsWith(".webp")) {
    return "image/webp";
  }

  return "application/octet-stream";
}

async function extractTextFromPdf(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/[ \t]{2,}/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return pages.join("\n\n").trim();
}

async function extractTextFromDocx(buffer: ArrayBuffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFileNames = Object.keys(zip.files)
    .filter((fileName) =>
      /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i.test(fileName),
    )
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  const chunks: string[] = [];

  for (const fileName of xmlFileNames) {
    const xml = await zip.files[fileName].async("text");
    const text = xmlToText(xml);
    if (text) {
      chunks.push(text);
    }
  }

  return chunks.join("\n\n").trim();
}

async function extractTextFromPlainText(buffer: ArrayBuffer) {
  return new TextDecoder().decode(new Uint8Array(buffer)).trim();
}

function getAutofillFields() {
  return REQUEST_FORM_FIELDS.filter((field) => field.active !== false && field.resumeAutofill);
}

function buildEmptyResult() {
  const values: Record<string, string> = { doctor_name: "" };

  for (const field of getAutofillFields()) {
    values[field.key] = "";
  }

  return values;
}

function buildPrompt(extractedText?: string) {
  const fieldLines = [
    'doctor_name: Full name of the doctor exactly as supported by the resume. Include title like "Dr." only if explicit.',
    ...getAutofillFields().map((field) => {
      const details = [field.label];
      if (field.description) {
        details.push(field.description);
      }
      if (field.resumeAutofillHint) {
        details.push(field.resumeAutofillHint);
      }
      if (field.options?.length) {
        details.push(`Allowed options: ${field.options.join(", ")}`);
      }
      return `${field.key}: ${details.join(" ")}`;
    }),
  ];

  const instructions = [
    "Extract resume details for a doctor request intake form.",
    "Return JSON only. Do not wrap in markdown.",
    "Use the exact keys provided.",
    "Use empty string for anything that is missing, unclear, or unsupported by the document.",
    "Do not guess personal motivations, patient stories, or narrative answers.",
    "Prefer factual resume content only.",
    "If a field is a list in the resume, join items into a readable semicolon-separated string.",
    "Keep wording concise.",
    "",
    "Keys to return:",
    ...fieldLines,
  ];

  if (extractedText) {
    instructions.push("", "Resume text:", extractedText);
  }

  return instructions.join("\n");
}

function stripJsonFence(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizeValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeValue(entry))
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

function sanitizeAutofillResult(raw: unknown) {
  const values = buildEmptyResult();
  const suggestedKeys: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { values, suggestedKeys };
  }

  for (const key of Object.keys(values)) {
    const normalized = normalizeValue((raw as Record<string, unknown>)[key]);
    values[key] = normalized;
    if (normalized) {
      suggestedKeys.push(key);
    }
  }

  return { values, suggestedKeys };
}

async function callGemini(prompt: string, inlinePart?: GeminiInlinePart) {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY is not configured.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: inlinePart ? [{ text: prompt }, inlinePart] : [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Resume extraction request failed.");
  }

  const candidateText = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!candidateText) {
    throw new Error("Resume extraction returned an empty response.");
  }

  return JSON.parse(stripJsonFence(candidateText));
}

export async function extractResumeAutofill(file: File): Promise<ResumeAutofillResult> {
  const warnings: string[] = [];
  const mimeType = guessMimeType(file.name, file.type);
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  let extractedText = "";
  let inlinePart: GeminiInlinePart | undefined;

  if (mimeType === "application/pdf") {
    try {
      extractedText = await extractTextFromPdf(buffer);
    } catch {
      warnings.push("vision-based extraction successfully used.");
      inlinePart = {
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      };
    }

    if (!inlinePart && extractedText.length < MIN_EXTRACTED_TEXT_LENGTH) {
      warnings.push("vision-based extraction successfully used.");
      inlinePart = {
        inline_data: {
          mime_type: mimeType,
          data: base64,
        },
      };
    }
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    extractedText = await extractTextFromDocx(buffer);
  } else if (mimeType === "text/plain") {
    extractedText = await extractTextFromPlainText(buffer);
  } else if (mimeType.startsWith("image/")) {
    inlinePart = {
      inline_data: {
        mime_type: mimeType,
        data: base64,
      },
    };
  } else if (file.name.toLowerCase().endsWith(".doc")) {
    throw new Error("Legacy .doc files are not supported yet. Please upload PDF, DOCX, or an image.");
  } else {
    throw new Error("Unsupported file type. Please upload PDF, DOCX, TXT, PNG, JPG, or WEBP.");
  }

  if (!inlinePart && extractedText.length === 0) {
    throw new Error("Could not read the uploaded resume. Please try a clearer PDF, DOCX, or image.");
  }

  const prompt = buildPrompt(extractedText);
  const rawResult = await callGemini(prompt, inlinePart);
  const sanitized = sanitizeAutofillResult(rawResult);

  return {
    values: sanitized.values,
    suggestedKeys: sanitized.suggestedKeys,
    warnings,
  };
}
