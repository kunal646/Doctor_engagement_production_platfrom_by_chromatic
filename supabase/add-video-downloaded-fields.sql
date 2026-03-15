alter table requests
  add column if not exists video_downloaded_at timestamptz,
  add column if not exists video_downloaded_by uuid references profiles(id) on delete set null;
