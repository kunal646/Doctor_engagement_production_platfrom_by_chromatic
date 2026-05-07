# Doctor Engagement Platform (MVP)

MVP management platform for:
- Ops teams from pharma companies to submit doctor video requests
- Admin team to manually upload storyboard PDFs and final videos
- Structured JSON handoff into `storyboard_maker`

## Stack:

- Next.js App Router + TypeScript
- Supabase Auth + Postgres + Storage
- Tailwind CSS
- Vercel deployment

## Local Setup

1. Install dependencies:
   - `npm install`
2. Create environment file:
   - `cp .env.example .env.local`
3. Fill env vars in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
4. Apply SQL migration in Supabase SQL editor:
   - `supabase/migration.sql`
5. Start app:
   - `npm run dev`

## Database Notes

- Core tables: `companies`, `profiles`, `requests`, `storyboards`, `storyboard_comments`, `videos`
- `requests.form_data` stores flexible JSON form answers (future-proof form keys)
- Storage buckets:
  - `request-assets` (ops uploads)
  - `storyboards` (admin PDF uploads)
  - `videos` (admin final video uploads)

## Roles

- `admin`: full portal access, can create company + ops credentials
- `ops`: scoped to one company, can create requests, comment, and approve storyboard

## Routes

- `/login`
- Ops:
  - `/dashboard`
  - `/requests/new`
  - `/requests/[id]`
- Admin:
  - `/admin/dashboard`
  - `/admin/requests/[id]`
  - `/admin/companies`

## Form Config

Dynamic form fields are defined in:
- `src/config/request-form.ts`

You can add/disable/reorder keys there without DB schema changes. Old data in `form_data` remains safe.
