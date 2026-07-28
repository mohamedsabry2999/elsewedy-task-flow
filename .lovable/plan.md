## Elsewedy Task Flow — Implementation Plan

A full-stack Arabic RTL internal workflow app for Elsewedy Print House, Sales → Design pipeline. This is a large build; I'll ship it in ordered phases so each phase is verifiable before moving on.

### Assumptions (please correct if wrong)
- **Auth**: Email/password only, public signup disabled. Admins create users from the Team page (using Cloud Auth admin API from a server function). No Google/Apple.
- **First admin**: I'll seed one Super Admin account (`admin@elsewedy.local` / temp password shown once in the seed banner) so you can log in immediately. You rotate it after.
- **Demo data**: A "Load demo data" and "Remove demo data" button in Settings, gated to Super Admin. Rows tagged `is_demo=true` for clean removal.
- **File storage**: Lovable Cloud Storage bucket `task-files` (private) for attachments + final files; external URLs also supported.
- **Excel export**: CSV export of the current filtered view (Excel opens CSV natively). True `.xlsx` only if you insist — adds a dependency.
- **Kanban**: Grouped by "الحالة العامة", drag-and-drop to change status (respecting role permissions).
- **Notifications**: In-app notification center (bell icon). No email/push in v1.
- **Timezone**: All timestamps stored UTC, displayed Africa/Cairo, 12-hour format with ص/م.
- **Months August–December 2026**: Each month page filters `tasks` by `created_at` within that month AND by `month_code` (AUG/SEP/…) derived from Task ID prefix, so tasks stay on their assigned month even if reopened later.

### Phase 1 — Foundation & Design System
- Enable Lovable Cloud.
- Cairo font via `<link>` in `__root.tsx`; RTL (`dir="rtl"`, `lang="ar"`).
- Design tokens in `src/styles.css`: Elsewedy red `#E30613`, orange `#FF5A2C`, charcoal, white, light gray — all as oklch semantic tokens (`--primary`, `--accent`, gradients, shadows). Notion-style spacious layout utilities.
- Root layout: app shell with sidebar nav (dashboard, months, all tasks, team, activity, settings) + top bar (search, notification bell, user menu).
- Root SEO head with app title.

### Phase 2 — Database & RLS
Migration creates:
- `app_role` enum (super_admin, admin, sales_manager, sales_executive, design_manager, designer, view_only)
- `overall_status`, `design_status`, `priority`, `customer_type`, `product_service` enums with the exact Arabic values specified
- `profiles` (id → auth.users, full_name, email, avatar_url, is_active, created_at)
- `user_roles` (user_id, role) + `has_role()` SECURITY DEFINER function
- `tasks` — every column from the spec, plus `task_code` (AUG-0001…), `month_code`, `sales_checklist jsonb`, `design_checklist jsonb`, `is_archived`, `is_demo`, `deleted_at`, timestamps
- `task_comments`, `task_attachments`, `task_activity`, `notifications`
- Storage bucket `task-files` (private) with owner-scoped policies
- RLS on every table:
  - View Only → SELECT only
  - Sales Executive → CRUD own tasks (sales fields); can't edit design fields
  - Sales Manager → all sales tasks
  - Designer → update design fields on tasks assigned to them + move to design statuses
  - Design Manager → all design fields, assign designers
  - Admin/Super Admin → full
- Trigger: on insert, auto-generate `task_code` from `month_code` + sequence
- Trigger: on `overall_status='جاهز للتصميم'` insert into designer queue (via activity + notification to Design Manager)
- Trigger: log every mutation to `task_activity`
- `GRANT`s per rules

### Phase 3 — Auth
- `/auth` public route: email/password login only, no signup form.
- Integration-managed `_authenticated` gate (already exists).
- Session-aware header, sign-out hygiene.
- Server fn `createUser` (admin-only) for Team page.

### Phase 4 — Task Data Layer (server fns)
- `listTasks(filters)`, `getTask(id)`, `createTask`, `updateTask` (partial), `archiveTask`, `restoreTask`, `deleteTask` (super admin), `addComment`, `addAttachment`, `listActivity`, `listNotifications`, `markNotificationRead`, `dashboardStats`, `loadDemoData`, `removeDemoData`.
- All use `requireSupabaseAuth`; RLS enforces role rules; server also re-validates role for destructive ops.

### Phase 5 — Views & Pages
- **Dashboard** (`/`): real KPI cards (total, at sales, ready for design, in design, awaiting approval, completed, overdue, completion %); charts by month, status, owner (recharts).
- **Month pages** (`/months/aug` … `/dec`): hero cover (generated image per month), icon, Quran verse, motivational line, workflow sketch (SVG), then task table filtered to that month.
- **All Tasks** (`/tasks`): full-featured table (search, sort, pagination, column visibility, filters on every important field), plus view switcher: Table / Kanban / My Tasks / Delayed / Completed.
- **Task detail drawer + `/tasks/$id` page**: all fields inline-editable per role, sales & design checklists, comments, attachments, activity timeline, final-file upload, delete-confirm, archive/restore.
- **Add Task**: multi-step form (Basic → Sales → Design brief → Review) with Zod validation.
- **Team** (`/team`): list users, invite/create (admin), change role, deactivate.
- **Activity** (`/activity`): global timeline with filters.
- **Settings** (`/settings`): profile, demo data controls (super admin), timezone display (fixed Africa/Cairo).
- **Notifications**: bell dropdown + `/notifications`.

### Phase 6 — Polish & Verify
- Overdue detection (delivery date < today AND not completed) → red badge + delayed view.
- CSV export of current filtered rows.
- All dates rendered Africa/Cairo, 12-hour with ص/م via `Intl.DateTimeFormat`.
- Manual QA via Playwright: log in as seeded admin, create task, move through statuses, verify designer queue updates, verify RLS by switching roles, verify export, verify demo-data toggle.
- Typecheck + build clean; no dead buttons.

### Technical notes
- Stack: TanStack Start + Query, Supabase (Lovable Cloud), shadcn/ui, recharts, zod, react-hook-form, @dnd-kit for Kanban, date-fns-tz for Cairo tz.
- Table: TanStack Table for sort/filter/visibility/pagination.
- All Arabic labels stored as constants in `src/lib/i18n.ts`.
- Enums duplicated as TS unions generated from `src/integrations/supabase/types.ts`.

### Deliverable scope note
This will land as ~40–60 files across 5–6 turns of work. I'll implement Phase 1+2+3 first (foundation, DB, auth, seeded admin) so you can log in and see the shell, then Phase 4+5 (data layer + all views), then Phase 6 (polish + QA). Approve to proceed, or tell me what to cut/change.
