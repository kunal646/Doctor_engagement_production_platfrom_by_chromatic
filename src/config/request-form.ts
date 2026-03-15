export type FormFieldType = "text" | "textarea" | "select";

export interface RequestFormField {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  description?: string;
  placeholder?: string;
  options?: string[];
  active?: boolean;
  resumeAutofill?: boolean;
  resumeAutofillHint?: string;
}

export const REQUEST_FORM_FIELDS: RequestFormField[] = [
  {
    key: "medical_specialty",
    label: "Medical Specialty",
    type: "text",
    required: true,
    description: "E.g. Endocrinology, Cardiology, Oncology",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "city",
    label: "City",
    type: "text",
    required: true,
    active: true,
    resumeAutofill: true,
  },
  {
    key: "primary_hospital_institution",
    label: "Primary Hospital / Institution",
    type: "text",
    required: true,
    description: "Where you currently practice or are most associated with",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "years_of_practice",
    label: "Years of Practice",
    type: "text",
    required: true,
    description: "Approximate is fine — e.g. 20 years",
    active: true,
    resumeAutofill: true,
    resumeAutofillHint: "Use explicit years of practice or estimate from training and work history only if clearly supported.",
  },
  {
    key: "degrees_completed",
    label: "Degrees Completed",
    type: "textarea",
    required: true,
    description: "List all degrees — MBBS, MD, MS, DM, DNB, etc.",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "colleges_universities_attended",
    label: "Colleges / Universities Attended",
    type: "textarea",
    required: true,
    description: "One per degree if different institutions",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "academic_distinctions",
    label: "Any academic distinctions?",
    type: "textarea",
    description:
      "Gold medals, university toppers, rank holders — list any that apply. Leave blank if none.",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "research_papers_published",
    label: "Approximately how many research papers have you published?",
    type: "text",
    description: "A rough number is fine — e.g. 50+, around 200, over 800",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "books_contributed",
    label: "Have you authored or contributed to any books?",
    type: "textarea",
    description: "List titles if you'd like, or just the number",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "leadership_roles",
    label: "Any leadership roles in your field?",
    type: "textarea",
    description:
      "Society president, committee member, guidelines author, department head — anything that shaped how your field operates",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "specialty_choice_reason",
    label: "Why did you choose this specialty?",
    type: "textarea",
    required: true,
    description: "2–3 sentences is enough. What drew you to this field over others?",
    active: true,
    resumeAutofill: false,
  },
  {
    key: "career_shaping_moment",
    label: "Was there a specific moment, patient, or experience that shaped the direction of your career?",
    type: "textarea",
    description:
      "Optional — but if there's a story, this is where it goes. Even a brief description helps.",
    active: true,
    resumeAutofill: false,
  },
  {
    key: "personal_journey",
    label: "Tell us about your journey",
    type: "textarea",
    description:
      "This is a more personal question. Type your answer here, or upload an audio note below instead.",
    placeholder: "Share the moments, challenges, or milestones that shaped your journey.",
    active: true,
    resumeAutofill: false,
  },
  {
    key: "awards_honours_received",
    label: "Awards or honours received",
    type: "textarea",
    description:
      "Name of award, year, and awarding body. E.g. Padma Shri, 2019, Government of India. List as many as relevant.",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "international_recognition_positions",
    label: "Any international recognition or positions?",
    type: "textarea",
    description: "International society roles, global awards, visiting faculty abroad, etc.",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "field_or_patient_impact",
    label: "What has changed in your field or for your patients because of your work?",
    type: "textarea",
    required: true,
    description:
      "This could be a treatment that's now standard, a guideline you helped write, a programme you started, or simply the number of patients you've treated. Think impact, not modesty.",
    active: true,
    resumeAutofill: false,
  },
  {
    key: "clinics_programmes_foundations",
    label: "Have you started any clinics, programmes, foundations, or initiatives?",
    type: "textarea",
    description: "Anything you built beyond your regular practice",
    active: true,
    resumeAutofill: true,
  },
  {
    key: "anything_else",
    label: "Anything else you'd like us to know?",
    type: "textarea",
    description:
      "A detail that doesn't fit above — a personal philosophy, a milestone, something you're proud of that hasn't come up yet",
    active: true,
    resumeAutofill: false,
  },
  {
    key: "young_photo_age",
    label: "Age in Younger Photo",
    type: "text",
    active: false,
  },
  {
    key: "current_photo_age",
    label: "Current Age in Recent Photo",
    type: "text",
    active: false,
  },
  {
    key: "young_photo_path",
    label: "Younger Photo",
    type: "text",
    active: false,
  },
  {
    key: "current_photo_path",
    label: "Current Photo",
    type: "text",
    active: false,
  },
  {
    key: "journey_audio_path",
    label: "Journey Audio",
    type: "text",
    active: false,
  },
];
