create table if not exists doctor_storyboard_review_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  storyboard_id uuid not null references storyboards(id) on delete cascade,
  storyboard_version integer not null,
  created_by uuid not null references profiles(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'submitted', 'revoked', 'applied')),
  expires_at timestamptz not null,
  storyboard_storage_path text,
  storyboard_slides jsonb,
  submitted_decision text check (submitted_decision in ('approve', 'changes_requested')),
  submitted_comment text,
  submitted_selections jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_doctor_storyboard_review_sessions_request_id
  on doctor_storyboard_review_sessions(request_id);

create index if not exists idx_doctor_storyboard_review_sessions_status
  on doctor_storyboard_review_sessions(status);

create index if not exists idx_doctor_storyboard_review_sessions_storyboard_id
  on doctor_storyboard_review_sessions(storyboard_id);

alter table doctor_storyboard_review_sessions enable row level security;

drop trigger if exists doctor_storyboard_review_sessions_set_updated_at on doctor_storyboard_review_sessions;
create trigger doctor_storyboard_review_sessions_set_updated_at
before update on doctor_storyboard_review_sessions
for each row
execute function set_updated_at();
