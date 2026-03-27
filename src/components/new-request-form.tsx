"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { REQUEST_FORM_FIELDS } from "@/config/request-form";
import { resolveRequestFieldCopy } from "@/config/request-form-doctor-type-copy";
import { saveRequestDraftAction, submitRequestAction } from "@/lib/actions";
import {
  MAX_ADDITIONAL_REFERENCE_PHOTOS,
  MAX_REFERENCE_PHOTOS_TOTAL,
} from "@/lib/additional-reference-photos";
import { createClient } from "@/lib/supabase/client";
import type { AdditionalReferencePhoto } from "@/lib/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircleIcon, PlusIcon, Trash2Icon } from "lucide-react";

const selectClassName =
  "h-11 w-full rounded-sm border border-input bg-background px-3.5 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

const DOCTOR_TYPE_OPTIONS = [
  { value: "KOL", label: "KOL" },
  { value: "KBL", label: "KBL" },
  { value: "General", label: "General" },
] as const;

function safeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
}

function buildInitialFormValues(
  initialDoctorName?: string,
  initialFormData?: Record<string, string>,
) {
  const initialValues: Record<string, string> = {
    doctor_name: initialDoctorName ?? "",
    doctor_type: initialFormData?.doctor_type ?? "",
  };

  for (const field of REQUEST_FORM_FIELDS) {
    initialValues[field.key] = initialFormData?.[field.key] ?? "";
  }

  return initialValues;
}

async function uploadReferenceAsset(file: File, prefix: string) {
  const response = await fetch("/api/uploads/signed-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket: "request-assets",
      filename: `${prefix}-${safeFileName(file.name)}`,
    }),
  });

  const payload = (await response.json()) as {
    path?: string;
    token?: string;
    error?: string;
  };

  if (!response.ok || !payload.path || !payload.token) {
    throw new Error(payload.error ?? "Failed to prepare asset upload.");
  }

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("request-assets")
    .uploadToSignedUrl(payload.path, payload.token, file);

  if (error) {
    throw new Error(error.message);
  }

  return payload.path;
}

type ExtraReferenceSlot = {
  id: string;
  age: string;
  path: string;
  file: File | null;
  previewUrl: string;
};

function createExtraReferenceSlots(
  initial: AdditionalReferencePhoto[] | undefined,
): ExtraReferenceSlot[] {
  if (!initial?.length) {
    return [];
  }
  return initial.map((row) => ({
    id: crypto.randomUUID(),
    age: row.age,
    path: row.path,
    file: null,
    previewUrl: "",
  }));
}

interface NewRequestFormProps {
  requestId?: string;
  initialDoctorName?: string;
  initialFormData?: Record<string, string>;
  initialYoungPhotoPath?: string;
  initialCurrentPhotoPath?: string;
  initialJourneyAudioPath?: string;
  initialAdditionalReferencePhotos?: AdditionalReferencePhoto[];
}

export function NewRequestForm({
  requestId,
  initialDoctorName,
  initialFormData,
  initialYoungPhotoPath = "",
  initialCurrentPhotoPath = "",
  initialJourneyAudioPath = "",
  initialAdditionalReferencePhotos,
}: NewRequestFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<"draft" | "final" | null>(null);
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [error, setError] = useState("");
  const [autofillError, setAutofillError] = useState("");
  const [autofillWarnings, setAutofillWarnings] = useState<string[]>([]);
  const [suggestedKeys, setSuggestedKeys] = useState<string[]>([]);
  const [formValues, setFormValues] = useState<Record<string, string>>(() =>
    buildInitialFormValues(initialDoctorName, initialFormData),
  );
  const [youngPhotoPreviewUrl, setYoungPhotoPreviewUrl] = useState("");
  const [currentPhotoPreviewUrl, setCurrentPhotoPreviewUrl] = useState("");
  const [extraReferenceSlots, setExtraReferenceSlots] = useState<ExtraReferenceSlot[]>(() =>
    createExtraReferenceSlots(initialAdditionalReferencePhotos),
  );
  const [journeyInputMode, setJourneyInputMode] = useState<"text" | "audio">(() => {
    if ((initialFormData?.personal_journey ?? "").trim()) {
      return "text";
    }
    if (initialJourneyAudioPath) {
      return "audio";
    }
    return "audio";
  });

  const activeFields = useMemo(
    () =>
      REQUEST_FORM_FIELDS.filter(
        (field) => field.active !== false && field.key !== "personal_journey",
      ),
    [],
  );
  const requiredActiveFields = useMemo(
    () => activeFields.filter((field) => field.required),
    [activeFields],
  );

  const updateFieldValue = (key: string, value: string) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const focusField = (name: string) => {
    const field = formRef.current?.elements.namedItem(name);
    if (field instanceof HTMLElement) {
      field.focus();
    }
  };

  useEffect(() => {
    return () => {
      if (youngPhotoPreviewUrl) {
        URL.revokeObjectURL(youngPhotoPreviewUrl);
      }
      if (currentPhotoPreviewUrl) {
        URL.revokeObjectURL(currentPhotoPreviewUrl);
      }
    };
  }, [currentPhotoPreviewUrl, youngPhotoPreviewUrl]);

  useEffect(() => {
    return () => {
      for (const slot of extraReferenceSlots) {
        if (slot.previewUrl) {
          URL.revokeObjectURL(slot.previewUrl);
        }
      }
    };
  }, [extraReferenceSlots]);

  const updatePreviewUrl = (
    file: File | undefined,
    currentPreviewUrl: string,
    setPreviewUrl: (value: string) => void,
  ) => {
    if (currentPreviewUrl) {
      URL.revokeObjectURL(currentPreviewUrl);
    }

    if (!file) {
      setPreviewUrl("");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleYoungPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updatePreviewUrl(event.target.files?.[0], youngPhotoPreviewUrl, setYoungPhotoPreviewUrl);
  };

  const handleCurrentPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    updatePreviewUrl(event.target.files?.[0], currentPhotoPreviewUrl, setCurrentPhotoPreviewUrl);
  };

  const addExtraReferenceSlot = () => {
    setExtraReferenceSlots((current) => {
      if (current.length >= MAX_ADDITIONAL_REFERENCE_PHOTOS) {
        return current;
      }
      return [
        ...current,
        { id: crypto.randomUUID(), age: "", path: "", file: null, previewUrl: "" },
      ];
    });
  };

  const removeExtraReferenceSlot = (id: string) => {
    setExtraReferenceSlots((current) => {
      const slot = current.find((s) => s.id === id);
      if (slot?.previewUrl) {
        URL.revokeObjectURL(slot.previewUrl);
      }
      return current.filter((s) => s.id !== id);
    });
  };

  const updateExtraReferenceAge = (id: string, age: string) => {
    setExtraReferenceSlots((current) =>
      current.map((s) => (s.id === id ? { ...s, age } : s)),
    );
  };

  const handleExtraReferenceFileChange = (id: string, file: File | undefined) => {
    setExtraReferenceSlots((current) =>
      current.map((slot) => {
        if (slot.id !== id) {
          return slot;
        }
        if (slot.previewUrl) {
          URL.revokeObjectURL(slot.previewUrl);
        }
        if (!file || file.size === 0) {
          return { ...slot, file: null, previewUrl: "" };
        }
        return { ...slot, file, previewUrl: URL.createObjectURL(file) };
      }),
    );
  };

  const handleResumeUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const resume = event.target.files?.[0];
    if (!resume || isAutofilling) {
      return;
    }

    setIsAutofilling(true);
    setAutofillError("");
    setAutofillWarnings([]);

    try {
      const payload = new FormData();
      payload.set("resume", resume);

      const response = await fetch("/api/resume-autofill", {
        method: "POST",
        body: payload,
      });

      const result = (await response.json()) as {
        error?: string;
        values?: Record<string, string>;
        suggestedKeys?: string[];
        warnings?: string[];
      };

      if (!response.ok || !result.values) {
        throw new Error(result.error ?? "Failed to extract resume details.");
      }

      setFormValues((current) => {
        const nextValues = { ...current };

        for (const [key, value] of Object.entries(result.values ?? {})) {
          if (typeof value === "string" && value.trim().length > 0) {
            nextValues[key] = value;
          }
        }

        return nextValues;
      });

      setSuggestedKeys(result.suggestedKeys ?? []);
      setAutofillWarnings(result.warnings ?? []);
    } catch (autofillIssue) {
      setAutofillError(
        autofillIssue instanceof Error
          ? autofillIssue.message
          : "Failed to extract resume details.",
      );
    } finally {
      setIsAutofilling(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const submitEvent = event.nativeEvent as SubmitEvent;
    const submitter = submitEvent.submitter as HTMLButtonElement | null;
    const intent = submitter?.value === "draft" ? "draft" : "final";

    setIsSubmitting(true);
    setSubmitIntent(intent);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const doctorName = String(formData.get("doctor_name") ?? "").trim();
    const doctorType = String(formData.get("field_doctor_type") ?? "").trim();
    const youngPhoto = formData.get("young_photo");
    const currentPhoto = formData.get("current_photo");
    const journeyAudio = formData.get("journey_audio");
    const youngPhotoAge = String(formData.get("field_young_photo_age") ?? "").trim();
    const currentPhotoAge = String(formData.get("field_current_photo_age") ?? "").trim();
    const existingYoungPhotoPath = String(formData.get("existing_young_photo_path") ?? "").trim();
    const existingCurrentPhotoPath = String(formData.get("existing_current_photo_path") ?? "").trim();
    const existingJourneyAudioPath = String(formData.get("existing_journey_audio_path") ?? "").trim();

    if (!doctorName) {
      setError("Please enter the doctor's full name.");
      setIsSubmitting(false);
      setSubmitIntent(null);
      focusField("doctor_name");
      return;
    }

    const hasNewYoungPhoto = youngPhoto instanceof File && youngPhoto.size > 0;
    const hasNewCurrentPhoto = currentPhoto instanceof File && currentPhoto.size > 0;
    const hasNewJourneyAudio = journeyAudio instanceof File && journeyAudio.size > 0;

    const extrasWithPhoto = extraReferenceSlots.filter((s) => s.file || s.path);
    if (extrasWithPhoto.length > MAX_ADDITIONAL_REFERENCE_PHOTOS) {
      setError(
        `You can add at most ${MAX_ADDITIONAL_REFERENCE_PHOTOS} optional photos (${MAX_REFERENCE_PHOTOS_TOTAL} reference photos in total).`,
      );
      setIsSubmitting(false);
      setSubmitIntent(null);
      return;
    }

    for (const slot of extraReferenceSlots) {
      const hasImage = Boolean(slot.file || slot.path);
      const hasAge = Boolean(String(slot.age).trim());
      if (hasImage !== hasAge) {
        setError("Each optional reference photo needs both an age and an image.");
        setIsSubmitting(false);
        setSubmitIntent(null);
        return;
      }
    }

    if (intent === "final") {
      if (!doctorType) {
        setError("Please select a doctor type.");
        setIsSubmitting(false);
        setSubmitIntent(null);
        focusField("field_doctor_type");
        return;
      }

      for (const field of requiredActiveFields) {
        const value = String(formData.get(`field_${field.key}`) ?? "").trim();
        if (!value) {
          setError(`Please complete ${field.label}.`);
          setIsSubmitting(false);
          setSubmitIntent(null);
          focusField(`field_${field.key}`);
          return;
        }
      }

      if (!youngPhotoAge) {
        setError("Please enter the age in the younger photo.");
        setIsSubmitting(false);
        setSubmitIntent(null);
        focusField("field_young_photo_age");
        return;
      }

      if (!currentPhotoAge) {
        setError("Please enter the current age in the recent photo.");
        setIsSubmitting(false);
        setSubmitIntent(null);
        focusField("field_current_photo_age");
        return;
      }

      if (!hasNewYoungPhoto && !existingYoungPhotoPath) {
        setError("Please upload a younger photo.");
        setIsSubmitting(false);
        setSubmitIntent(null);
        focusField("young_photo");
        return;
      }

      if (!hasNewCurrentPhoto && !existingCurrentPhotoPath) {
        setError("Please upload a current photo.");
        setIsSubmitting(false);
        setSubmitIntent(null);
        focusField("current_photo");
        return;
      }

    }

    try {
      const youngPhotoPath = hasNewYoungPhoto
        ? await uploadReferenceAsset(youngPhoto, "young-photo")
        : existingYoungPhotoPath;
      const currentPhotoPath = hasNewCurrentPhoto
        ? await uploadReferenceAsset(currentPhoto, "current-photo")
        : existingCurrentPhotoPath;
      const journeyAudioPath =
        journeyInputMode === "audio"
          ? hasNewJourneyAudio
            ? await uploadReferenceAsset(journeyAudio, "journey-audio")
            : existingJourneyAudioPath
          : "";

      const resolvedAdditionalReferencePhotos: AdditionalReferencePhoto[] = [];
      for (const slot of extraReferenceSlots) {
        if (!slot.file && !slot.path) {
          continue;
        }
        let storagePath = slot.path;
        if (slot.file) {
          storagePath = await uploadReferenceAsset(slot.file, "reference-extra");
        }
        const age = String(slot.age).trim();
        if (storagePath && age) {
          resolvedAdditionalReferencePhotos.push({ path: storagePath, age });
        }
      }

      formData.delete("young_photo");
      formData.delete("current_photo");
      formData.delete("journey_audio");

      if (journeyInputMode === "text") {
        formData.delete("journey_audio_path");
      } else {
        formData.delete("field_personal_journey");
      }

      formData.set(
        "additional_reference_photos_json",
        JSON.stringify(resolvedAdditionalReferencePhotos),
      );

      formData.set(
        "asset_paths_json",
        JSON.stringify(
          [
            youngPhotoPath,
            currentPhotoPath,
            ...resolvedAdditionalReferencePhotos.map((p) => p.path),
            journeyAudioPath,
          ].filter(Boolean),
        ),
      );

      if (requestId) {
        formData.set("request_id", requestId);
      }

      if (youngPhotoPath) {
        formData.set("young_photo_path", youngPhotoPath);
      } else {
        formData.delete("young_photo_path");
      }

      if (currentPhotoPath) {
        formData.set("current_photo_path", currentPhotoPath);
      } else {
        formData.delete("current_photo_path");
      }

      if (journeyAudioPath) {
        formData.set("journey_audio_path", journeyAudioPath);
      } else {
        formData.delete("journey_audio_path");
      }

      const result =
        intent === "draft"
          ? await saveRequestDraftAction(formData)
          : await submitRequestAction(formData);
      setIsSubmitting(false);
      setSubmitIntent(null);
      router.push(result.redirectTo);
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to save the request.",
      );
      setIsSubmitting(false);
      setSubmitIntent(null);
    }
  };

  const isEditingDraft = Boolean(requestId);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <input type="hidden" name="request_id" value={requestId ?? ""} />
      <input type="hidden" name="existing_young_photo_path" value={initialYoungPhotoPath} />
      <input type="hidden" name="existing_current_photo_path" value={initialCurrentPhotoPath} />
      <input type="hidden" name="existing_journey_audio_path" value={initialJourneyAudioPath} />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Request Intake</CardTitle>
          <CardDescription>
            Complete the essentials first, then use resume autofill to speed up the factual fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resume_autofill">Autofill From Resume</Label>
            <p className="text-sm leading-6 text-muted-foreground">
              Upload a PDF, DOCX, TXT, PNG, JPG, or WEBP file and we&apos;ll suggest answers for
              the factual fields. Legacy `.doc` files are not supported yet.
            </p>
          </div>
          <Input
            id="resume_autofill"
            type="file"
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
            onChange={handleResumeUpload}
            disabled={isAutofilling || isSubmitting}
          />
          <p className="text-sm text-muted-foreground">
            {isAutofilling
              ? "Extracting details from the uploaded resume..."
              : "Suggested values can still be edited before submitting."}
          </p>
          {autofillWarnings.map((warning) => (
            <p key={warning} className="text-sm text-muted-foreground">
              {warning}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Doctor Details</CardTitle>
          <CardDescription>
            Keep this information factual and easy to verify.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="doctor_name">Full Name *</Label>
            <p className="text-sm leading-6 text-muted-foreground">
              Include the preferred prefix such as Dr. or Prof.
            </p>
            <Input
              id="doctor_name"
              name="doctor_name"
              required
              placeholder="Dr. Jane Doe"
              value={formValues.doctor_name}
              onChange={(event) => updateFieldValue("doctor_name", event.target.value)}
            />
            {suggestedKeys.includes("doctor_name") ? (
              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Suggested from resume
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="field_doctor_type">Doctor Type *</Label>
            <p className="text-sm leading-6 text-muted-foreground">
              Key opinion leader (KOL), key brand leader (KBL), or a general participant.
            </p>
            <select
              id="field_doctor_type"
              name="field_doctor_type"
              required
              value={formValues.doctor_type ?? ""}
              onChange={(event) => updateFieldValue("doctor_type", event.target.value)}
              className={selectClassName}
            >
              <option value="" disabled>
                Select doctor type
              </option>
              {DOCTOR_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
            {activeFields.map((field) => {
              const copy = resolveRequestFieldCopy(field, formValues.doctor_type ?? "");
              return (
                <div
                  key={field.key}
                  className={
                    field.type === "textarea"
                      ? "space-y-2 md:col-span-2"
                      : "flex h-full min-h-0 flex-col gap-2"
                  }
                >
                  <Label htmlFor={`field_${field.key}`}>
                    {copy.label}
                    {field.required ? " *" : ""}
                    {suggestedKeys.includes(field.key) ? (
                      <span className="ml-2 text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
                        Suggested
                      </span>
                    ) : null}
                  </Label>
                  {field.type === "textarea" ? (
                    <>
                      {copy.description ? (
                        <p className="text-sm leading-6 text-muted-foreground">{copy.description}</p>
                      ) : null}
                      <Textarea
                        id={`field_${field.key}`}
                        name={`field_${field.key}`}
                        rows={4}
                        required={field.required}
                        placeholder={copy.placeholder}
                        value={formValues[field.key] ?? ""}
                        onChange={(event) => updateFieldValue(field.key, event.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      {copy.description ? (
                        <p className="shrink-0 text-sm leading-6 text-muted-foreground">
                          {copy.description}
                        </p>
                      ) : null}
                      <div className="mt-auto w-full min-w-0">
                        {field.type === "select" ? (
                          <select
                            id={`field_${field.key}`}
                            name={`field_${field.key}`}
                            required={field.required}
                            value={formValues[field.key] ?? ""}
                            onChange={(event) => updateFieldValue(field.key, event.target.value)}
                            className={selectClassName}
                          >
                            <option value="" disabled>
                              Select {copy.label}
                            </option>
                            {(field.options ?? []).map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`field_${field.key}`}
                            name={`field_${field.key}`}
                            required={field.required}
                            placeholder={copy.placeholder}
                            value={formValues[field.key] ?? ""}
                            onChange={(event) => updateFieldValue(field.key, event.target.value)}
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Personal Journey</CardTitle>
          <CardDescription>
            Choose the format that is easiest for the doctor to share.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex min-h-12 items-center gap-3 rounded-sm border px-4 py-3 text-sm transition-colors ${
                journeyInputMode === "audio"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background"
              }`}
            >
              <input
                type="radio"
                name="journey_input_mode"
                value="audio"
                checked={journeyInputMode === "audio"}
                onChange={() => setJourneyInputMode("audio")}
              />
              Audio note
            </label>
            <label
              className={`flex min-h-12 items-center gap-3 rounded-sm border px-4 py-3 text-sm transition-colors ${
                journeyInputMode === "text"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background"
              }`}
            >
              <input
                type="radio"
                name="journey_input_mode"
                value="text"
                checked={journeyInputMode === "text"}
                onChange={() => setJourneyInputMode("text")}
              />
              Written answer
            </label>
          </div>

          {journeyInputMode === "audio" ? (
            <div className="space-y-2">
              <Label htmlFor="journey_audio">Upload Audio Note</Label>
              <p className="text-sm leading-6 text-muted-foreground">
                Upload a voice note about the doctor&apos;s journey.
              </p>
              {initialJourneyAudioPath ? (
                <p className="text-sm text-muted-foreground">
                  An audio note is already attached. Upload a new one only if you want to replace
                  it.
                </p>
              ) : null}
              <Input id="journey_audio" name="journey_audio" type="file" accept="audio/*" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="field_personal_journey">Type Your Answer</Label>
              <Textarea
                id="field_personal_journey"
                name="field_personal_journey"
                rows={5}
                placeholder="Share the moments, challenges, or milestones that shaped your journey."
                value={formValues.personal_journey}
                onChange={(event) => updateFieldValue("personal_journey", event.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Reference Photos</CardTitle>
          <CardDescription>
            We need one younger photo and one current photo. You can add up to{" "}
            {MAX_ADDITIONAL_REFERENCE_PHOTOS} optional photos with ages ({MAX_REFERENCE_PHOTOS_TOTAL}{" "}
            reference photos maximum in total).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>1. Share a full photo or a clear face photo.</p>
              <p>2. Two photos are required: one younger and one current or recent.</p>
              <p>3. Optionally add more life-stage photos — each needs an age at the time of the photo.</p>
              <p>4. Avoid family or group photos. Cropped portraits focused only on the doctor are fine.</p>
              <p>These photos may also be used later to create a digital sketch reference.</p>
            </div>
            <img
              src="/reference-photo-sketch.png"
              alt="Photo guide sketch: Good — individual portrait or cropped face. Avoid — family or group photos."
              className="w-full rounded-sm border object-contain"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="field_young_photo_age">Age in Younger Photo *</Label>
              <Input
                id="field_young_photo_age"
                name="field_young_photo_age"
                type="number"
                min="1"
                required
                placeholder="25"
                value={formValues.young_photo_age}
                onChange={(event) => updateFieldValue("young_photo_age", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="young_photo">Younger Photo *</Label>
              {initialYoungPhotoPath ? (
                <p className="text-sm text-muted-foreground">
                  A younger photo is already attached. Upload a new file only if you want to
                  replace it.
                </p>
              ) : null}
              <Input
                id="young_photo"
                name="young_photo"
                type="file"
                accept="image/*"
                required
                onChange={handleYoungPhotoChange}
              />
              {youngPhotoPreviewUrl ? (
                <div className="flex items-center gap-3 rounded-sm border p-3">
                  <img
                    src={youngPhotoPreviewUrl}
                    alt="Preview of the uploaded younger photo"
                    className="h-16 w-16 rounded-sm border object-cover"
                  />
                  <p className="text-sm text-muted-foreground">Preview of the selected younger photo.</p>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="field_current_photo_age">Current Age in Recent Photo *</Label>
              <Input
                id="field_current_photo_age"
                name="field_current_photo_age"
                type="number"
                min="1"
                required
                placeholder="52"
                value={formValues.current_photo_age}
                onChange={(event) => updateFieldValue("current_photo_age", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="current_photo">Current / Recent Photo *</Label>
              {initialCurrentPhotoPath ? (
                <p className="text-sm text-muted-foreground">
                  A current photo is already attached. Upload a new file only if you want to
                  replace it.
                </p>
              ) : null}
              <Input
                id="current_photo"
                name="current_photo"
                type="file"
                accept="image/*"
                required
                onChange={handleCurrentPhotoChange}
              />
              {currentPhotoPreviewUrl ? (
                <div className="flex items-center gap-3 rounded-sm border p-3">
                  <img
                    src={currentPhotoPreviewUrl}
                    alt="Preview of the uploaded current photo"
                    className="h-16 w-16 rounded-sm border object-cover"
                  />
                  <p className="text-sm text-muted-foreground">Preview of the selected current photo.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 border-t pt-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium">Optional reference photos</p>
                <p className="text-sm text-muted-foreground">
                  Add up to {MAX_ADDITIONAL_REFERENCE_PHOTOS} more ({MAX_REFERENCE_PHOTOS_TOTAL}{" "}
                  photos total). Each needs an age in the photo and an image.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={addExtraReferenceSlot}
                disabled={
                  isSubmitting ||
                  extraReferenceSlots.length >= MAX_ADDITIONAL_REFERENCE_PHOTOS
                }
              >
                <PlusIcon className="size-4" />
                Add photo
              </Button>
            </div>

            {extraReferenceSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No optional photos yet. Use &quot;Add photo&quot; if you want more life stages.
              </p>
            ) : (
              <ul className="space-y-4">
                {extraReferenceSlots.map((slot, index) => (
                  <li
                    key={slot.id}
                    className="rounded-sm border border-border bg-muted/20 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        Optional photo {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeExtraReferenceSlot(slot.id)}
                        disabled={isSubmitting}
                        aria-label="Remove optional photo"
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor={`extra_ref_age_${slot.id}`}>Age in this photo *</Label>
                        <Input
                          id={`extra_ref_age_${slot.id}`}
                          type="number"
                          min="1"
                          placeholder="40"
                          value={slot.age}
                          onChange={(e) => updateExtraReferenceAge(slot.id, e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`extra_ref_file_${slot.id}`}>Photo *</Label>
                        {slot.path && !slot.file ? (
                          <p className="text-sm text-muted-foreground">
                            A photo is already saved for this slot. Choose a new file only to replace
                            it.
                          </p>
                        ) : null}
                        <Input
                          id={`extra_ref_file_${slot.id}`}
                          type="file"
                          accept="image/*"
                          disabled={isSubmitting}
                          onChange={(e) =>
                            handleExtraReferenceFileChange(slot.id, e.target.files?.[0])
                          }
                        />
                        {slot.previewUrl ? (
                          <div className="flex items-center gap-3 rounded-sm border p-3">
                            <img
                              src={slot.previewUrl}
                              alt=""
                              className="h-16 w-16 rounded-sm border object-cover"
                            />
                            <p className="text-sm text-muted-foreground">Preview</p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {autofillError ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertDescription>{autofillError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="sticky bottom-0 z-20 mb-4 flex flex-col gap-3 border bg-background/95 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur md:mb-0 md:flex-row md:justify-end md:p-4">
        <Button
          type="submit"
          value="draft"
          disabled={isSubmitting}
          variant="outline"
          className="w-full sm:w-auto"
        >
          {isSubmitting && submitIntent === "draft"
            ? "Saving..."
            : isEditingDraft
              ? "Save Draft Changes"
              : "Save Draft"}
        </Button>
        <Button type="submit" value="final" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting && submitIntent === "final"
            ? "Submitting..."
            : isEditingDraft
              ? "Submit Final"
              : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}
