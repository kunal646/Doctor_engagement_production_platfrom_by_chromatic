create table if not exists doctor_review_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  created_by uuid not null references profiles(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'submitted', 'revoked', 'applied')),
  expires_at timestamptz not null,
  base_doctor_name text not null,
  base_form_data jsonb not null default '{}'::jsonb,
  submitted_doctor_name text,
  submitted_form_data jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_doctor_review_sessions_request_id
  on doctor_review_sessions(request_id);

create index if not exists idx_doctor_review_sessions_status
  on doctor_review_sessions(status);

create index if not exists idx_doctor_review_sessions_expires_at
  on doctor_review_sessions(expires_at);

create index if not exists idx_doctor_review_sessions_request_created_at
  on doctor_review_sessions(request_id, created_at desc);

alter table doctor_review_sessions enable row level security;

drop trigger if exists doctor_review_sessions_set_updated_at on doctor_review_sessions;
create trigger doctor_review_sessions_set_updated_at
before update on doctor_review_sessions
for each row
execute function set_updated_at();
