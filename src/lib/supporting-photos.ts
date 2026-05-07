import type { SupportingPhoto } from "@/lib/types";

export const MAX_SUPPORTING_PHOTOS_PER_FIELD = 5;

export type SupportingPhotoFieldConfig = {
  fieldKey: string;
  label: string;
  description: string;
};

export const SUPPORTING_PHOTO_FIELD_CONFIGS: SupportingPhotoFieldConfig[] = [
  {
    fieldKey: "degrees_completed",
    label: "Graduation / degree photos",
    description: "Convocation photos, degree-day images, or degree certificates.",
  },
  {
    fieldKey: "colleges_universities_attended",
    label: "College / university photos",
    description: "Campus, college-era, or institution photos that help set the scene.",
  },
  {
    fieldKey: "academic_distinctions",
    label: "Academic distinction photos",
    description: "Gold medals, rank certificates, topper certificates, or related photos.",
  },
  {
    fieldKey: "research_papers_published",
    label: "Research supporting photos",
    description: "Journal covers, paper screenshots, conference posters, or publication certificates.",
  },
  {
    fieldKey: "books_contributed",
    label: "Book / chapter photos",
    description: "Book covers, chapter screenshots, launch photos, or editorial proof.",
  },
  {
    fieldKey: "leadership_roles",
    label: "Leadership supporting photos",
    description: "Society certificates, committee photos, conference dais photos, or role letters.",
  },
  {
    fieldKey: "specialty_choice_reason",
    label: "Specialty story photos",
    description: "Optional photos from the phase or moment that drew the doctor to this specialty.",
  },
  {
    fieldKey: "career_shaping_moment",
    label: "Career moment photos",
    description: "Photos connected to a career-shaping phase, hospital, team, or milestone.",
  },
  {
    fieldKey: "awards_honours_received",
    label: "Award / honour photos",
    description: "Award ceremony photos, trophies, certificates, or press clippings.",
  },
  {
    fieldKey: "international_recognition_positions",
    label: "Fellowship / international photos",
    description: "Fellowship, observership, global conference, invitation, or visiting faculty photos.",
  },
  {
    fieldKey: "field_or_patient_impact",
    label: "Impact supporting photos",
    description: "Photos connected to programmes, camps, initiatives, or visible patient/community impact.",
  },
  {
    fieldKey: "clinics_programmes_foundations",
    label: "Clinic / programme photos",
    description: "Clinic photos, inauguration images, camp photos, banners, or team photos.",
  },
  {
    fieldKey: "personal_journey",
    label: "Personal journey photos",
    description: "Optional life-stage or story photos that support the personal journey answer.",
  },
  {
    fieldKey: "hobbies_interests",
    label: "Lifestyle / hobby photos",
    description: "Optional personal-interest photos for a warmer closing beat.",
  },
  {
    fieldKey: "anything_else",
    label: "Other supporting photos",
    description: "Photos that do not fit the earlier sections but may help production.",
  },
];

const SUPPORTING_PHOTO_FIELD_KEY_SET = new Set(
  SUPPORTING_PHOTO_FIELD_CONFIGS.map((config) => config.fieldKey),
);

export function getSupportingPhotoConfig(fieldKey: string) {
  return SUPPORTING_PHOTO_FIELD_CONFIGS.find((config) => config.fieldKey === fieldKey) ?? null;
}

export function parseSupportingPhotos(raw: unknown): SupportingPhoto[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const out: SupportingPhoto[] = [];
  const countsByField = new Map<string, number>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const rec = entry as { fieldKey?: unknown; path?: unknown };
    const fieldKey = typeof rec.fieldKey === "string" ? rec.fieldKey.trim() : "";
    const path = typeof rec.path === "string" ? rec.path.trim() : "";

    if (!fieldKey || !path || !SUPPORTING_PHOTO_FIELD_KEY_SET.has(fieldKey)) {
      continue;
    }

    const currentCount = countsByField.get(fieldKey) ?? 0;
    if (currentCount >= MAX_SUPPORTING_PHOTOS_PER_FIELD) {
      continue;
    }

    countsByField.set(fieldKey, currentCount + 1);
    out.push({ fieldKey, path });
  }

  return out;
}

export function groupSupportingPhotosByField(photos: SupportingPhoto[]) {
  const groups = new Map<string, SupportingPhoto[]>();

  for (const photo of photos) {
    groups.set(photo.fieldKey, [...(groups.get(photo.fieldKey) ?? []), photo]);
  }

  return groups;
}
