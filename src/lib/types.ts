import { StoryboardRevisionSelection, StoryboardSlide } from "@/lib/storyboard";

export type UserRole = "admin" | "ops" | "supervisor";

export type DoctorReviewSessionStatus =
  | "active"
  | "submitted"
  | "revoked"
  | "applied";

export type DoctorStoryboardReviewDecision = "approve" | "changes_requested";

export type RequestStatus =
  | "draft"
  | "form_submitted"
  | "storyboard_in_progress"
  | "storyboard_review"
  | "changes_requested"
  | "storyboard_approved"
  | "video_in_progress"
  | "video_delivered";

export type JsonRecord = Record<string, string | number | boolean | string[]>;

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface RequestRow {
  id: string;
  company_id: string;
  created_by: string;
  doctor_name: string;
  status: RequestStatus;
  form_data: JsonRecord;
  storyboard_revision_count: number;
  max_storyboard_revisions: number;
  video_downloaded_at?: string | null;
  video_downloaded_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoryboardRow {
  id: string;
  request_id: string;
  storage_path: string | null;
  pdf_url?: string | null;
  slides?: StoryboardSlide[] | null;
  version: number;
  uploaded_by: string;
  created_at: string;
}

export interface StoryboardCommentRow {
  id: string;
  request_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface VideoRow {
  id: string;
  request_id: string;
  storage_path: string | null;
  video_url?: string | null;
  uploaded_by: string;
  created_at: string;
}

export interface DoctorReviewSessionRow {
  id: string;
  request_id: string;
  created_by: string;
  token_hash: string;
  status: DoctorReviewSessionStatus;
  expires_at: string;
  base_doctor_name: string;
  base_form_data: JsonRecord;
  submitted_doctor_name: string | null;
  submitted_form_data: JsonRecord | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorStoryboardReviewSessionRow {
  id: string;
  request_id: string;
  storyboard_id: string;
  storyboard_version: number;
  created_by: string;
  token_hash: string;
  status: DoctorReviewSessionStatus;
  expires_at: string;
  storyboard_storage_path: string | null;
  storyboard_slides: StoryboardSlide[] | null;
  submitted_decision: DoctorStoryboardReviewDecision | null;
  submitted_comment: string | null;
  submitted_selections: StoryboardRevisionSelection[] | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expiration_time: number | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}
