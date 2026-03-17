"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { REQUEST_FORM_FIELDS } from "@/config/request-form";
import { saveRequestDraftAction, submitRequestAction } from "@/lib/actions";
import { createClient } from "@/lib/supabase/client";
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
import { AlertCircleIcon } from "lucide-react";

const selectClassName =
  "h-11 w-full rounded-sm border border-input bg-background px-3.5 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30";

function safeFileName(fileName: string) {
  return fileName.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
}

function buildInitialFormValues(
  initialDoctorName?: string,
  initialFormData?: Record<string, string>,
) {
  const initialValues: Record<string, string> = {
    doctor_name: initialDoctorName ?? "",
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

interface NewRequestFormProps {
  requestId?: string;
  initialDoctorName?: string;
  initialFormData?: Record<string, string>;
  initialYoungPhotoPath?: string;
  initialCurrentPhotoPath?: string;
  initialJourneyAudioPath?: string;
}

export function NewRequestForm({
  requestId,
  initialDoctorName,
  initialFormData,
  initialYoungPhotoPath = "",
  initialCurrentPhotoPath = "",
  initialJourneyAudioPath = "",
}: NewRequestFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const updateFieldValue = (key: string, value: string) => {
    setFormValues((current) => ({
      ...current,
      [key]: value,
    }));
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
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const youngPhoto = formData.get("young_photo");
    const currentPhoto = formData.get("current_photo");
    const journeyAudio = formData.get("journey_audio");
    const personalJourney = String(formData.get("field_personal_journey") ?? "").trim();
    const existingYoungPhotoPath = String(formData.get("existing_young_photo_path") ?? "").trim();
    const existingCurrentPhotoPath = String(formData.get("existing_current_photo_path") ?? "").trim();
    const existingJourneyAudioPath = String(formData.get("existing_journey_audio_path") ?? "").trim();

    const hasNewYoungPhoto = youngPhoto instanceof File && youngPhoto.size > 0;
    const hasNewCurrentPhoto = currentPhoto instanceof File && currentPhoto.size > 0;
    const hasNewJourneyAudio = journeyAudio instanceof File && journeyAudio.size > 0;

    if (intent === "final") {
      if (!hasNewYoungPhoto && !existingYoungPhotoPath) {
        setError("Please upload a younger photo.");
        setIsSubmitting(false);
        return;
      }

      if (!hasNewCurrentPhoto && !existingCurrentPhotoPath) {
        setError("Please upload a current photo.");
        setIsSubmitting(false);
        return;
      }

      if (journeyInputMode === "text") {
        if (personalJourney.length === 0) {
          setError("Please type your journey.");
          setIsSubmitting(false);
          return;
        }
      } else if (!hasNewJourneyAudio && !existingJourneyAudioPath) {
        setError("Please upload an audio note about your journey.");
        setIsSubmitting(false);
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

      formData.delete("young_photo");
      formData.delete("current_photo");
      formData.delete("journey_audio");

      if (journeyInputMode === "text") {
        formData.delete("journey_audio_path");
      } else {
        formData.delete("field_personal_journey");
      }

      formData.set(
        "asset_paths_json",
        JSON.stringify([youngPhotoPath, currentPhotoPath, journeyAudioPath].filter(Boolean)),
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

      if (intent === "draft") {
        await saveRequestDraftAction(formData);
      } else {
        await submitRequestAction(formData);
      }
      setIsSubmitting(false);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Failed to save the request.",
      );
      setIsSubmitting(false);
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

          <div className="grid gap-5 md:grid-cols-2">
            {activeFields.map((field) => (
              <div
                key={field.key}
                className={field.type === "textarea" ? "space-y-2 md:col-span-2" : "space-y-2"}
              >
                <Label htmlFor={`field_${field.key}`}>
                  {field.label}
                  {field.required ? " *" : ""}
                  {suggestedKeys.includes(field.key) ? (
                    <span className="ml-2 text-xs font-normal uppercase tracking-[0.08em] text-muted-foreground">
                      Suggested
                    </span>
                  ) : null}
                </Label>
                {field.description ? (
                  <p className="text-sm leading-6 text-muted-foreground">{field.description}</p>
                ) : null}
                {field.type === "textarea" ? (
                  <Textarea
                    id={`field_${field.key}`}
                    name={`field_${field.key}`}
                    rows={4}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={formValues[field.key] ?? ""}
                    onChange={(event) => updateFieldValue(field.key, event.target.value)}
                  />
                ) : field.type === "select" ? (
                  <select
                    id={`field_${field.key}`}
                    name={`field_${field.key}`}
                    required={field.required}
                    value={formValues[field.key] ?? ""}
                    onChange={(event) => updateFieldValue(field.key, event.target.value)}
                    className={selectClassName}
                  >
                    <option value="" disabled>
                      Select {field.label}
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
                    placeholder={field.placeholder}
                    value={formValues[field.key] ?? ""}
                    onChange={(event) => updateFieldValue(field.key, event.target.value)}
                  />
                )}
              </div>
            ))}
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
            We need one younger photo and one current photo to guide the creative team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p>1. Share a full photo or a clear face photo.</p>
              <p>2. We need two photos: one younger photo and one current or recent photo.</p>
              <p>3. Avoid family or group photos. Cropped portraits focused only on the doctor are fine.</p>
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
          {isSubmitting ? "Saving..." : isEditingDraft ? "Save Draft Changes" : "Save Draft"}
        </Button>
        <Button type="submit" value="final" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting
            ? "Submitting..."
            : isEditingDraft
              ? "Submit Final"
              : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}
