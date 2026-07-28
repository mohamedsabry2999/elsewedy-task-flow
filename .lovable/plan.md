
# Elsewedy Task Flow — Full Upgrade Plan

I'll ship this in phases across multiple turns. Each phase ends with a preview you can test before I continue. All work is additive — no data or table drops.

## Phase A — Logo + React #418 fix + auth stability (this turn's next reply)

1. Upload the official logo via `lovable-assets create` from `/mnt/user-uploads/el_sewedy_logo.png` → `src/assets/elsewedy-logo.png.asset.json`.
2. Generate a square favicon derivative (brand mark only) and wire it in `__root.tsx`; delete `public/favicon.ico`.
3. Replace every "E" square badge with the real logo:
   - Sidebar header (`_authenticated/route.tsx`)
   - Login page (`auth.tsx`)
   - Dashboard header (`dashboard.tsx`)
   - Loading / empty states (a new `<BrandMark />` component)
   - Mobile header (new)
4. Add `og:image` on `index.tsx` + `auth.tsx` leaves only, using the CDN URL.
5. Diagnose React #418: read published console, then check `__root.tsx`, `router.tsx`, `auth.tsx`, `index.tsx` for SSR/CSR mismatches (very likely `typeof window` or auth-check in a `useState` initializer, or a top-level route that reads `localStorage`). Fix by moving auth checks into `useEffect` / `beforeLoad({ ssr: false })` and adding a proper loading screen on first paint.
6. Ship a real "checking session…" splash using `<BrandMark />` so first paint is stable.

## Phase B — RBAC/RLS enforcement end-to-end

1. Sync `src/lib/permissions.ts` matrix to real server-side gates.
2. Rewrite RLS on `tasks`:
   - SELECT: super_admin/admin/managers see all; sales_executive sees own or created; designer sees assigned or unassigned in design queue; view_only sees all read-only.
   - UPDATE: split into per-column via `BEFORE UPDATE` trigger `enforce_task_field_permissions()` that raises Arabic errors when a role touches a forbidden column.
3. Add server-side guard function `assert_can_transition(task, new_status)` used inside `updateTask` / `quickUpdateTask`.
4. Suspended/archived users (`profiles.is_active=false` or `archived_at not null`) → block in `_authenticated/route.tsx` `beforeLoad` (sign out + redirect with Arabic message) and in a DB helper `is_user_active()` used by RLS.
5. Update `profiles.last_sign_in_at` via `handle_new_user`-style trigger on `auth.users` sign-in (already provided by Supabase — sync via server fn on session load).
6. Admin cannot grant super_admin; guard in `adminSetRole` (already partially there — verify).
7. Apply `user_permission_overrides` in `effectivePerm()`.

## Phase C — Task Details drawer redesign

1. Rewrite `TaskDetailDrawer.tsx` as a large RTL sheet (`Sheet side="left"`), full-screen on mobile.
2. Header block: name, code, client, status/priority badges, sales owner, designer, due date + overdue badge, last-updated + last-updated-by (needs `updated_by uuid` column — added in migration).
3. Header actions row: تحديث سريع / تعديل التاسك / إضافة تعليق / رفع ملف / نسخ الرابط / أرشفة (permission-gated).
4. Tabs: نظرة عامة / بيانات المبيعات / بيانات التصميم / الملفات / التعليقات / سجل التحديثات.
5. Remove auto-save on blur. All editable inputs live inside `QuickUpdateDialog` or `FullEditDialog` with controlled state, dirty tracking, unsaved-changes AlertDialog, single Save.
6. Overview computes checklists %, latest comment/file/activity, remaining time / overdue duration in Africa/Cairo tz.
7. Status transition validation client-side + server-side; on block, show Arabic list of missing fields.
8. Reopen dialog with mandatory note; Stop dialog with mandatory reason (stored in `task_activity.details`).

## Phase D — File management (Supabase Storage)

1. Create private bucket `task-files` via `supabase--storage_create_bucket`.
2. Storage RLS on `storage.objects` scoped to `tasks/<task_id>/…` and task read access.
3. Server fns: `uploadTaskFile`, `listTaskFiles`, `deleteTaskFile`, `signTaskFileUrl` (short-lived signed URL for downloads/previews).
4. Files tab: drag-drop, progress, category select (مرجع/مبدئي/تعديل/مراجعة/نهائية), size, mime, uploader, date, preview (image/pdf), copy signed link, delete with confirm, version bump on reupload of same name.
5. Keep external `files_url` / `final_version_url` text fields as an "or paste link" option.

## Phase E — Comments + Activity polish

1. Wire `parent_id` (threaded replies), `is_internal`, `is_pinned`, `edited_at` into the Comments tab.
2. Edit/delete own comment with confirm; pin allowed to managers/admins; internal-note toggle shown only to internal roles.
3. Attach a file to a comment (reuses Storage flow).
4. Activity tab: Arabic sentence builder for every diff kind (status, designer, sales owner, priority, dates, files, comments, approvals, reopen/stop). Uses user avatar + name from `profiles`. Africa/Cairo 12h format.

## Phase F — Notifications + sound + siren + overdue engine

1. Migration:
   - `tasks.due_at timestamptz` (derived from `delivery_due_date` end-of-day Cairo when absent).
   - `notifications.kind text`, `severity text` ('normal'|'urgent'), `task_id` (exists), `data jsonb`, `played_at timestamptz` (per-user played state — actually a new `notification_reads` if needed, but simplest: add `played_at` to `notifications` since each row is per-user).
   - `notification_preferences` table (per user, jsonb settings).
   - `overdue_events` table to dedupe siren reminders (`task_id`, `user_id`, `sent_at`).
2. `pg_cron` job every 5 min → `POST /api/public/hooks/overdue-scan` (TanStack server route) authenticated by `apikey` = anon key. Route:
   - Finds tasks past `due_at`, not completed/stopped/archived.
   - For each affected recipient (per role rules), inserts a `severity='urgent'` notification if none in current window; schedules next reminder per policy (immediate → 30 min → 4 h in working hours).
3. DB triggers for domain events → notifications: task created, status change, comment added, file uploaded, revision requested, assignment change, approval, completion.
4. Client:
   - Notification bell in desktop TopBar + mobile header.
   - Pulses red when unread; strong pulse for any unread `urgent`.
   - Realtime via Supabase Realtime subscription on `notifications` filtered by `user_id`.
   - Web Audio API sounds: `normal.mp3` + `siren.mp3` uploaded as assets. Play once per notification id (persisted `played_at`). Use `BroadcastChannel('notif')` so only one tab plays. First-session "تفعيل صوت التنبيهات" prompt to satisfy autoplay policy.
   - Desktop `Notification` API opt-in (only after button click).
5. Settings page: `إعدادات التنبيهات` reading/writing `notification_preferences` — sounds on/off, volume sliders, per-event toggles, quiet hours, working hours, test buttons.

## Phase G — Mobile / responsive

1. Sidebar becomes `Sheet` behind hamburger under 1024px.
2. New `<MobileHeader />` with logo, hamburger, notification bell.
3. Remove `mr-64` on small screens; use responsive grid.
4. Tasks table → card list on <768px.
5. Drawer becomes full-screen `Sheet` under 768px.
6. Test viewports 1440 / 1024 / 768 / 390.

## Phase H — Final QA

Playwright walk-throughs of the acceptance list you provided, production build check, published console clean.

## Technical notes / risks

- React #418 is almost always a hydration mismatch. Since the app uses `ssr: false` on `_authenticated`, the likely culprit is a `Date.now()`/`localStorage`/`window` read in a top-level component or `router.tsx` context. I'll instrument first, fix root cause, then verify against the published build via `stack_modern--invoke-server-function` and browser console.
- All migrations additive, wrapped in `IF NOT EXISTS`.
- Storage bucket `task-files` is private; downloads use short-lived signed URLs.
- Sound assets: MP3s uploaded via `lovable-assets`; total ~50 KB.
- No service-role key ever leaves the server; admin ops stay in `requireSupabaseAuth` handlers with `has_role` checks.

## What I will NOT change

- Cairo font, RTL, red/orange color tokens.
- Dashboard math (only bug fixes if I find them).
- Existing routes and slugs.
- Existing users, tasks, comments, files, activity rows.

Confirm and I'll start Phase A immediately: logo everywhere + React #418 fix + auth splash. Each subsequent phase will land in its own turn so you can review before I proceed.
