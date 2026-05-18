-- Stores admin feedback when a submitted request is sent back to draft for corrections.
alter table requests add column if not exists admin_rejection_reason text;
alter table requests add column if not exists admin_rejected_at timestamptz;

comment on column requests.admin_rejection_reason is
  'Shown to ops when status is draft; cleared when the request is submitted again.';
comment on column requests.admin_rejected_at is
  'Timestamp when admin moved the request back to draft with admin_rejection_reason.';
