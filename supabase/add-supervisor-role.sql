-- Step 1: Add 'supervisor' to the user_role enum
-- NOTE: This must be committed before the value can be used in enum comparisons.
-- We work around this by casting to text in constraints and policies below.
alter type user_role add value if not exists 'supervisor';

-- Step 2: Update the profiles constraint using text cast to avoid
-- the "unsafe use of new value" error within the same transaction.
alter table profiles drop constraint if exists profiles_role_company_check;
alter table profiles add constraint profiles_role_company_check check (
  (role::text = 'admin' and company_id is null) or
  (role::text in ('ops', 'supervisor') and company_id is not null)
);

-- Supervisor RLS: read-only access to company profiles
drop policy if exists "supervisor_read_company_profiles" on profiles;
create policy "supervisor_read_company_profiles"
on profiles
for select
using (
  current_user_role()::text = 'supervisor' and
  (
    role::text = 'admin' or
    company_id = current_user_company_id()
  )
);

-- Supervisor RLS: read-only access to company requests
drop policy if exists "supervisor_read_company_requests" on requests;
create policy "supervisor_read_company_requests"
on requests
for select
using (
  current_user_role()::text = 'supervisor' and company_id = current_user_company_id()
);

-- Supervisor RLS: read-only access to storyboards via company
drop policy if exists "supervisor_read_storyboards" on storyboards;
create policy "supervisor_read_storyboards"
on storyboards
for select
using (
  exists (
    select 1
    from requests r
    where r.id = storyboards.request_id
      and r.company_id = current_user_company_id()
      and current_user_role()::text = 'supervisor'
  )
);

-- Supervisor RLS: read-only access to storyboard comments via company
drop policy if exists "supervisor_read_comments" on storyboard_comments;
create policy "supervisor_read_comments"
on storyboard_comments
for select
using (
  exists (
    select 1
    from requests r
    where r.id = storyboard_comments.request_id
      and r.company_id = current_user_company_id()
      and current_user_role()::text = 'supervisor'
  )
);

-- Supervisor RLS: read-only access to videos via company
drop policy if exists "supervisor_read_videos" on videos;
create policy "supervisor_read_videos"
on videos
for select
using (
  exists (
    select 1
    from requests r
    where r.id = videos.request_id
      and r.company_id = current_user_company_id()
      and current_user_role()::text = 'supervisor'
  )
);

-- Update storage: read request-assets (now includes supervisor via company_id match)
drop policy if exists "ops_read_request_assets" on storage.objects;
create policy "ops_read_request_assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'request-assets' and (
    current_user_role()::text = 'admin' or
    split_part(name, '/', 1) = current_user_company_id()::text
  )
);

-- Update storage: read storyboards/videos (add supervisor alongside ops)
drop policy if exists "read_storyboards_videos" on storage.objects;
create policy "read_storyboards_videos"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('storyboards', 'videos') and
  (
    current_user_role()::text = 'admin' or
    exists (
      select 1
      from requests r
      where r.id::text = split_part(name, '/', 1)
        and r.company_id = current_user_company_id()
        and current_user_role()::text in ('ops', 'supervisor')
    )
  )
);
