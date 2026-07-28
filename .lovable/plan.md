# توسيع Elsewedy Task Flow لدعم جميع الأقسام

هذا تطوير ضخم يمس البنية الأساسية (قاعدة البيانات، RLS، Storage، الواجهة، الصلاحيات، Workflows). لن أنفّذه في جلسة واحدة — سأقسّمه إلى **4 مراحل مستقلة**، وأنتظر تأكيدك قبل كل مرحلة.

## المبادئ الحاكمة

- **عدم كسر السيلز/التصميم**: كل ما هو موجود يبقى يعمل. الأعمدة القديمة (`sales_owner_id`, `designer_id`) تبقى مؤقتًا مع Backfill إلى `task_assignments`.
- **ديناميكية كاملة**: لا أقسام Hardcoded، لا أنواع مهام ثابتة، لا Workflows مثبتة في الكود.
- **RLS أولًا**: أي جدول جديد يتضمن Policies + Grants في نفس الـMigration.
- **Migration واحدة لكل مرحلة**، وموافقتك عليها شرط للانتقال.

---

## المرحلة الأولى — الأساس التنظيمي (Foundation)

**الجداول الجديدة:**
- `departments` (name_ar, name_en, key, color, icon, description, sort_order, is_archived)
- `department_memberships` (user_id, department_id, role, is_primary, starts_at, ends_at, active)
- `task_types` (department_id nullable للأنواع العامة, name_ar, name_en, key, color, icon, default_priority, default_sla_hours, is_archived)
- `task_assignments` (task_id, user_id, department_id, role, stage, is_primary, assigned_by, assigned_at, completed_at, active)
- `task_departments` (task_id, department_id, stage_order, is_current)
- إضافة أعمدة على `tasks`: `department_id`, `task_type_id`, `workflow_kind` (department/cross_dept/request/approval/recurring/project/sales_design)

**الصلاحيات الجديدة (app_role جديدة أو Overrides):**
- `manage_departments`, `manage_department_members`, `manage_task_types`, `view_department_tasks`, `view_all_department_tasks`, `assign_department_tasks`

**تحديث `can_view_task`** بالترتيب:
1. Super Admin / System Supervisor → allow
2. Explicit deny في `user_permission_overrides` → deny
3. Explicit allow → allow
4. Department Manager لقسم مرتبط بالتاسك → allow
5. Assignment نشط في `task_assignments` → allow
6. الحقول القديمة (sales_owner/designer) → allow (توافق خلفي)
7. افتراضيًا → deny

**Migration ترحيل السيلز/التصميم:**
- إنشاء قسمَي "المبيعات" و"التصميم" مع Keys ثابتة.
- ربط المستخدمين حسب أدوارهم الحالية.
- إنشاء Task Type "Sales-to-Design" مربوط بالقسمين.
- Backfill `task_assignments` من `sales_owner_id` + `designer_id` لكل التاسكات الموجودة.
- عدم حذف الحقول القديمة.

**الواجهة:**
- صفحة جديدة "إدارة الأقسام" داخل `/structure` كتبويب ثالث بجانب "السنوات والشهور" و"القوالب".
- CRUD كامل + Drag-and-drop للترتيب + بحث + فلترة.
- تبويب فرعي "الأعضاء" داخل كل قسم لإدارة العضويات.

**شروط القبول للمرحلة الأولى:**
- إنشاء/أرشفة قسم من الواجهة يعمل.
- إضافة أعضاء بأدوار مختلفة.
- كل تاسك موجود مربوط بقسم + نوع + Assignments صحيحة.
- السيلز/التصميم يعملان بدون أي تغيير مرئي.
- Type-check نظيف.

---

## المرحلة الثانية — Workflows الديناميكية

- `workflow_definitions` + `workflow_stages` + `workflow_transitions` مربوطة بـ Task Type.
- تحديث `task_templates` لدعم `department_id` و `task_type_id`.
- طبقات الحقول (Global / Department / Task Type / Stage / Month) مع أولوية الحل.
- الحالات (statuses_config) تصبح مرتبطة بالـWorkflow لا بالنظام.
- صفحات ولوحات الأقسام الديناميكية (`/departments/$key`) مع KPIs مشابهة للـDashboard.
- Sidebar ديناميكي يعرض فقط أقسام المستخدم.

## المرحلة الثالثة — التعاون بين الأقسام

- Cross-Department Tasks مع Timeline ونقل تلقائي.
- `interdepartment_requests` (طلب/رفض/سبب/تقييم).
- `recurring_task_rules` + Job لإنشاء النسخ (`pg_cron` + endpoint موجود).
- `sla_policies` + `company_working_days` + `company_holidays` + تصعيد.

## المرحلة الرابعة — المشروعات والتقارير

- `projects` + `project_members` + `project_milestones` (ميزانية بصلاحية منفصلة).
- محرّر إنشاء تاسك جديد بـStepper (قسم → نوع → نموذج ديناميكي → مسؤولين → مراجعة).
- تقارير شاملة + اختبارات E2E لكل دور.

---

## تقنيًا (للمراجعة السريعة)

```text
Phase 1 migration order:
  1. CREATE TYPE department_role, workflow_kind
  2. CREATE TABLE departments (+GRANT +RLS +policies)
  3. CREATE TABLE department_memberships (+GRANT +RLS +policies)
  4. CREATE TABLE task_types (+GRANT +RLS +policies)
  5. CREATE TABLE task_assignments (+GRANT +RLS +policies)
  6. CREATE TABLE task_departments (+GRANT +RLS +policies)
  7. ALTER tasks ADD department_id, task_type_id, workflow_kind
  8. INSERT seed: قسم Sales, قسم Design, Task Type "Sales-to-Design"
  9. INSERT membership backfill من user_roles
 10. INSERT task_assignments backfill من sales_owner_id/designer_id
 11. UPDATE tasks SET department_id/task_type_id للسيلز-تصميم الحالية
 12. CREATE OR REPLACE can_view_task (النسخة الجديدة الموسّعة)
 13. Triggers: log_assignment_changes, prevent_delete_dept_with_data
```

---

## طريقة العمل المقترحة

1. **الآن**: تؤكّد الموافقة على المرحلة الأولى فقط.
2. أنفّذ Migration المرحلة الأولى + الواجهة الأساسية لإدارة الأقسام.
3. تختبرها، ثم ننتقل للمرحلة الثانية.

هل نبدأ بالمرحلة الأولى؟ أم تريد تعديلًا على النطاق أو الترتيب (مثلًا: تأجيل Task Types إلى المرحلة الثانية، أو دمج المهام المتكررة مع الطلبات)؟
