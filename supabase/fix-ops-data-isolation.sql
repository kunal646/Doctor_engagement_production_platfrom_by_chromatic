-- Fix: Ops users should only see their OWN requests, not all company requests.
-- Supervisor sees all company requests (read-only).

-- 1. Requests: ops can only READ their own requests
drop policy if exists "ops_read_company_requests" on requests;
create policy "ops_read_own_requests"
on requests
for select
using (
  current_user_role()::text = 'ops' and
  company_id = current_user_company_id() and
  created_by = auth.uid()
);

-- 2. Requests: ops can only UPDATE their own requests (approve/revise storyboard)
drop policy if exists "ops_update_storyboard_approved_status" on requests;
create policy "ops_update_own_request_storyboard_status"
on requests
for update
using (
  current_user_role()::text = 'ops' and
  company_id = current_user_company_id() and
  created_by = auth.uid() and
  status = 'storyboard_review'
)
with check (
  current_user_role()::text = 'ops' and
  company_id = current_user_company_id() and
  created_by = auth.uid() and
  status in ('storyboard_approved', 'changes_requested')
);

-- 3. Storyboards: ops can only read storyboards for their own requests
drop policy if exists "ops_read_storyboards_for_company" on storyboards;
create policy "ops_read_own_storyboards"
on storyboards
for select
using (
  exists (
    select 1
    from requests r
    where r.id = storyboards.request_id
      and r.created_by = auth.uid()
      and current_user_role()::text = 'ops'
  )
);

-- 4. Comments: ops can only read comments on their own requests
drop policy if exists "ops_read_comments_for_company" on storyboard_comments;
create policy "ops_read_own_comments"
on storyboard_comments
for select
using (
  exists (
    select 1
    from requests r
    where r.id = storyboard_comments.request_id
      and r.created_by = auth.uid()
      and current_user_role()::text = 'ops'
  )
);

-- 5. Comments: ops can only insert comments on their own requests
drop policy if exists "ops_insert_comments_for_company" on storyboard_comments;
create policy "ops_insert_own_comments"
on storyboard_comments
for insert
with check (
  user_id = auth.uid() and
  exists (
    select 1
    from requests r
    where r.id = storyboard_comments.request_id
      and r.created_by = auth.uid()
      and current_user_role()::text = 'ops'
  )
);

-- 6. Videos: ops can only read videos for their own requests
drop policy if exists "ops_read_videos_for_company" on videos;
create policy "ops_read_own_videos"
on videos
for select
using (
  exists (
    select 1
    from requests r
    where r.id = videos.request_id
      and r.created_by = auth.uid()
      and current_user_role()::text = 'ops'
  )
);
