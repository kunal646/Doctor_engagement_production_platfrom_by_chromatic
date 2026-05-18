-- When the intake form is submitted to production (status = form_submitted), not when the draft row was created.
alter table requests add column if not exists form_submitted_at timestamptz;

comment on column requests.form_submitted_at is
  'Timestamp when ops last submitted the intake (status became form_submitted). Null while draft.';

-- Backfill: approximate historical submissions with row creation time for non-draft records.
update requests
set form_submitted_at = created_at
where form_submitted_at is null
  and status::text != 'draft';
