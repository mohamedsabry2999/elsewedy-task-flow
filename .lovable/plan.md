
# Elsewedy Task Flow — Upgrade Plan

This is a large upgrade of the existing project. I will preserve all current data, tables, users, tasks, comments, files, and activity. No table drops or renames. Migrations will be additive only.

## Phase 0 — Audit (no code changes)
Read and confirm current state of:
- `src/routes/_authenticated/*` (dashboard, tasks, months, team, activity, settings, route.tsx)
- `src/components/tasks/TasksExplorer.tsx`, `TaskDetailDrawer.tsx`
- `src/lib/tasks.functions.ts`, `admin.functions.ts`, `i18n.ts`
- Current DB schema (profiles, user_roles, tasks, task_comments, task_attachments, task_activity, notifications) and existing RLS
- Sidebar entries, auth flow, notification center

Goal: reuse existing pieces (e.g. `team.tsx` becomes the new Users & Permissions page; existing `updateTask` server fn extended, not replaced).

## Phase 1 — Database (additive migration)
Add ONLY missing pieces, keep everything existing:

- `profiles`: add `phone text`, `avatar_url` (exists), `department text`, `job_title text`, `branch text`, `last_sign_in_at timestamptz`, `archived_at timestamptz`.
- `user_permission_overrides` (new): `(user_id, permission_key, value)` with RLS restricted to admins.
- `task_attachments`: add `file_size bigint`, `mime_type text`, `version int default 1`, and keep `kind` for category (مرجع/مبدئي/تعديل/مراجعة/نهائية).
- `task_comments`: add `parent_id uuid null`, `is_internal bool default false`, `is_pinned bool default false`, `edited_at timestamptz`.
- `task_activity`: already logs field diffs via trigger; extend trigger to also diff `priority`, `delivery_due_date`, `final_version_url`, `actual_delivery_date`, `delivered`.
- Guard function `prevent_last_super_admin()` — trigger on `user_roles` DELETE/UPDATE and on `profiles.is_active` UPDATE to block removing/disabling the last active super_admin.
- Guard function on tasks: validate transitions to `جاهز للتصميم`, `بانتظار الاعتماد`, `مكتمل` (checks required fields; raises Arabic exception if missing). Runs in a BEFORE UPDATE trigger.
- RLS refinements:
  - Sales fields: restrict UPDATE of Sales columns to admins/sales roles via a column-level trigger (Postgres RLS is row-level, so use a BEFORE UPDATE trigger `enforce_task_field_permissions()` that raises when a non-authorized role tries to change protected columns).
  - Designers can only update design columns on tasks where `designer_id = auth.uid()` OR they are design_manager/admin.
- Indices on `tasks(designer_id)`, `tasks(sales_owner_id)`, `tasks(overall_status)`, `task_activity(task_id, created_at desc)`.

All GRANTs preserved for new tables.

## Phase 2 — Server functions
Extend `src/lib/tasks.functions.ts` and `admin.functions.ts`:

- `quickUpdateTask({id, patch})` — same as updateTask but batches allowed fields and returns diff.
- `archiveTask`, `restoreTask`, `reopenTask({id, note})`, `stopTask({id, reason})`.
- `listTaskFiles`, `uploadTaskFile` (uses new Supabase storage bucket `task-files`), `deleteTaskFile`.
- `addComment` extended: `parent_id`, `is_internal`; new `editComment`, `deleteComment`, `pinComment`.
- Admin: `adminUpdateProfile`, `adminResetPassword` (sends reset email), `adminArchiveUser`, `adminSetPermissionOverride`, `adminListPermissionMatrix`.
- Every mutation goes through `requireSupabaseAuth`; role checks re-verified server-side using `has_role`/`has_any_role` RPCs.

## Phase 3 — Storage
Create `task-files` private bucket + RLS on `storage.objects` allowing authenticated users to read/write files under `tasks/<task_id>/...` when they can access the task.

## Phase 4 — Users & Permissions page
Rename/repurpose `src/routes/_authenticated/team.tsx` → keep route, upgrade content. Route gated to super_admin/admin via `beforeLoad` calling a new `getMyRoles` server fn (redirect otherwise). Sidebar item shown conditionally.

- Header + KPI cards (total, active, suspended, sales team, design team, managers).
- Search + filters (role, department, status, branch).
- Table with all requested columns and row actions (view/edit/change role/reset password/suspend/reactivate/archive) with confirm dialogs.
- 3-step "Add User" dialog (personal / access / confirm) calling existing `adminCreateUser` extended with new profile fields.
- Guards: cannot self-delete/disable, cannot remove last super_admin (enforced client + DB trigger).
- Tab 2 `مصفوفة الصلاحيات`: matrix of permissions × roles with 4 states (سماح كامل / المهام الخاصة فقط / قراءة فقط / غير مسموح). Super_admin can edit overrides; changes persisted to `user_permission_overrides` (per-user) plus a base matrix constant in `src/lib/permissions.ts`.

## Phase 5 — Task Details redesign
Replace `TaskDetailDrawer.tsx` internals with:
- Rich header (name, code, client, status, priority, owners, due date, overdue badge, last-updated).
- Header actions: تعديل التاسك / تحديث سريع / إضافة تعليق / رفع ملف / نسخ الرابط / أرشفة.
- Tabs (shadcn `Tabs`): Overview / Sales / Design / Files / Comments / Activity.
- Overview shows progress, checklists, latest comment/file/activity.
- Sales & Design tabs render form sections with field-level permission gating using `src/lib/permissions.ts` helper `canEditField(role, field)`.
- `تحديث سريع` dialog: compact form (overall_status, design_status, priority, sales_owner, designer, due_date, note). Shows diff summary before save; saves in one call.
- `تعديل التاسك` dialog: full sectioned form, unsaved-changes tracker (blocks close), disabled save until dirty, validation, single Save button.
- Comments tab: threaded, edit/delete own, pin (managers), internal notes toggle.
- Files tab: drag-drop upload, category select, list w/ preview/download/delete, versioning.
- Activity tab: Arabic timeline with old→new diffs.

## Phase 6 — Sidebar / permissions plumbing
- `src/lib/permissions.ts`: PERMISSIONS constant, PERMISSION_MATRIX default, `useMyPermissions()` hook that reads roles + overrides from server fn.
- Sidebar filters items using `useMyPermissions()`.
- `_authenticated/route.tsx` sidebar: add "المستخدمون والصلاحيات" (Users icon, Shield accent) for admins only.

## Phase 7 — Polish
- Confirm dialogs (shadcn AlertDialog) for all destructive actions.
- Arabic toasts everywhere.
- Skeletons on all lists.
- Mobile: task drawer becomes full-screen sheet on <768px; table falls back to card list.
- Africa/Cairo tz in `format.ts` (already partially present) — audit and unify to 12h Arabic.

## Phase 8 — Verify
- Run typecheck + build.
- Manual role walk-through via Playwright against localhost for: admin creates user, sales creates task, designer updates status, protected field write blocked at DB, quick update, full edit, activity written with diffs.

## Technical notes
- Field-level permissions are enforced twice: UI (`canEditField`) and DB trigger `enforce_task_field_permissions` — the DB is the source of truth.
- No service-role key in browser; admin ops stay in `requireSupabaseAuth` server functions that verify role via `has_role` before loading `supabaseAdmin` inside the handler (per repo rules).
- Migrations are additive only — no `DROP` on existing tables/columns.
- `user_roles` behavior preserved; multi-role support kept.

## What I will NOT change
- Existing Cairo/RTL styling and color tokens.
- Dashboard math and month pages (only bug fixes if found in audit).
- Existing auth flow / auth.tsx bootstrap.
- Existing routes; `team.tsx` is upgraded in place (URL stays `/team`, label becomes "المستخدمون والصلاحيات") unless you prefer a new `/users` route.

Confirm and I will start with the audit reads, then the migration, then code.
