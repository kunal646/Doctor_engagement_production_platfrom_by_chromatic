import { randomBytes, createHash } from "crypto";

import { headers } from "next/headers";

import { REQUEST_FORM_FIELDS } from "@/config/request-form";
import {
  DoctorReviewSessionRow,
  JsonRecord,
} from "@/lib/types";

export const DOCTOR_REVIEW_LINK_TTL_HOURS = 24 * 7;

export const DOCTOR_REVIEW_FIELDS = REQUEST_FORM_FIELDS.filter(
  (field) => !field.key.endsWith("_path"),
);

export function normalizeDoctorReviewValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeDoctorReviewValue(entry))
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

export function buildDoctorReviewFormSnapshot(formData: JsonRecord) {
  const snapshot: Record<string, string> = {};

  for (const field of DOCTOR_REVIEW_FIELDS) {
    snapshot[field.key] = normalizeDoctorReviewValue(formData[field.key]);
  }

  return snapshot;
}

export function collectDoctorReviewSubmission(formData: FormData) {
  const values: JsonRecord = {};

  for (const field of DOCTOR_REVIEW_FIELDS) {
    const rawValue = formData.get(`field_${field.key}`);
    values[field.key] = normalizeDoctorReviewValue(rawValue);
  }

  return values;
}

export function generateDoctorReviewToken() {
  return randomBytes(32).toString("hex");
}

export function hashDoctorReviewToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildDoctorReviewLink(baseUrl: string, token: string) {
  return `${baseUrl}/doctor-review/${token}`;
}

export async function getRequestBaseUrl() {
  const headerList = await headers();
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";

  return `${protocol}://${host}`;
}

export function isDoctorReviewExpired(session: Pick<DoctorReviewSessionRow, "expires_at">) {
  return new Date(session.expires_at).getTime() <= Date.now();
}

export function countDoctorReviewChanges(session: Pick<
  DoctorReviewSessionRow,
  "base_doctor_name" | "submitted_doctor_name" | "base_form_data" | "submitted_form_data"
>) {
  let changes = 0;

  if (
    session.submitted_doctor_name !== null &&
    session.submitted_doctor_name.trim() !== session.base_doctor_name.trim()
  ) {
    changes += 1;
  }

  const submitted = session.submitted_form_data ?? {};
  const base = session.base_form_data ?? {};

  for (const field of DOCTOR_REVIEW_FIELDS) {
    const baseValue = normalizeDoctorReviewValue(base[field.key]);
    const submittedValue = normalizeDoctorReviewValue(submitted[field.key]);

    if (baseValue !== submittedValue) {
      changes += 1;
    }
  }

  return changes;
}
