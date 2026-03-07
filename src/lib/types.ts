import { StoryboardSlide } from "@/lib/storyboard";

export type UserRole = "admin" | "ops" | "supervisor";

export type RequestStatus =
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
