
-- ============================================================
-- PHASE 1: Multi-department foundation
-- ============================================================

-- 1) ENUMS
DO $$ BEGIN
  CREATE TYPE public.department_role AS ENUM (
    'department_manager','department_supervisor','team_leader','employee','viewer'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.workflow_kind AS ENUM (
    'department','cross_department','request','approval','recurring','project','sales_to_design'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.assignment_role AS ENUM (
    'owner','assignee','reviewer','approver','collaborator','follower'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#E30613',
  icon TEXT NOT NULL DEFAULT 'Building2',
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- helper: can manage departments
CREATE OR REPLACE FUNCTION public.can_manage_departments(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_permission_overrides
      WHERE user_id = _user_id AND permission_key = 'manage_departments' AND value = 'allow'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_department_members(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_permission_overrides
      WHERE user_id = _user_id AND permission_key = 'manage_department_members' AND value = 'allow'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_task_types(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_permission_overrides
      WHERE user_id = _user_id AND permission_key = 'manage_task_types' AND value = 'allow'
    )
  );
$$;

CREATE POLICY departments_select_all ON public.departments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY departments_manage ON public.departments
  FOR ALL TO authenticated
  USING (public.can_manage_departments(auth.uid()))
  WITH CHECK (public.can_manage_departments(auth.uid()));

CREATE TRIGGER trg_departments_updated
  BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) department_memberships
CREATE TABLE IF NOT EXISTS public.department_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.department_role NOT NULL DEFAULT 'employee',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  starts_at DATE,
  ends_at DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_memberships TO authenticated;
GRANT ALL ON public.department_memberships TO service_role;
ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_department_manager(_user_id uuid, _department_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_memberships
    WHERE user_id = _user_id AND department_id = _department_id
      AND active = true AND role = 'department_manager'
  );
$$;

CREATE POLICY dm_select ON public.department_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR public.can_manage_department_members(auth.uid())
    OR public.is_department_manager(auth.uid(), department_id)
  );
CREATE POLICY dm_manage ON public.department_memberships
  FOR ALL TO authenticated
  USING (
    public.can_manage_department_members(auth.uid())
    AND user_id <> auth.uid()  -- can't manage yourself
  )
  WITH CHECK (
    public.can_manage_department_members(auth.uid())
    AND user_id <> auth.uid()
  );

CREATE TRIGGER trg_dm_updated
  BEFORE UPDATE ON public.department_memberships FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_dm_user ON public.department_memberships(user_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_dm_dept ON public.department_memberships(department_id) WHERE active = true;

-- 4) task_types
CREATE TABLE IF NOT EXISTS public.task_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL, -- NULL = global
  key TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#FF5A2C',
  icon TEXT NOT NULL DEFAULT 'ClipboardList',
  description TEXT,
  default_priority public.priority NOT NULL DEFAULT 'عادية',
  default_sla_hours INTEGER,
  template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  code_prefix TEXT, -- e.g. SALES, MKT, HR
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_types TO authenticated;
GRANT ALL ON public.task_types TO service_role;
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY tt_select_all ON public.task_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tt_manage ON public.task_types
  FOR ALL TO authenticated
  USING (public.can_manage_task_types(auth.uid()))
  WITH CHECK (public.can_manage_task_types(auth.uid()));

CREATE TRIGGER trg_tt_updated
  BEFORE UPDATE ON public.task_types FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) task_assignments
CREATE TABLE IF NOT EXISTS public.task_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  role public.assignment_role NOT NULL DEFAULT 'assignee',
  stage TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignments TO authenticated;
GRANT ALL ON public.task_assignments TO service_role;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ta_task ON public.task_assignments(task_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_ta_user ON public.task_assignments(user_id) WHERE active = true;

CREATE TRIGGER trg_ta_updated
  BEFORE UPDATE ON public.task_assignments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) task_departments
CREATE TABLE IF NOT EXISTS public.task_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  stage_order INTEGER NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT false,
  entered_at TIMESTAMPTZ,
  exited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_departments TO authenticated;
GRANT ALL ON public.task_departments TO service_role;
ALTER TABLE public.task_departments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_td_task ON public.task_departments(task_id);
CREATE INDEX IF NOT EXISTS idx_td_dept ON public.task_departments(department_id);

-- 7) ALTER tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_type_id UUID REFERENCES public.task_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workflow_kind public.workflow_kind NOT NULL DEFAULT 'sales_to_design';

CREATE INDEX IF NOT EXISTS idx_tasks_department ON public.tasks(department_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.tasks(task_type_id);

-- 8) SEED: Sales + Design departments
INSERT INTO public.departments (key, name_ar, name_en, color, icon, sort_order)
VALUES
  ('sales',  'المبيعات', 'Sales',  '#E30613', 'Handshake',  10),
  ('design', 'التصميم',  'Design', '#FF5A2C', 'Palette',    20)
ON CONFLICT (key) DO NOTHING;

-- 9) SEED: Sales-to-Design task type
INSERT INTO public.task_types (key, name_ar, name_en, color, icon, code_prefix, department_id, sort_order)
SELECT 'sales_to_design', 'من المبيعات إلى التصميم', 'Sales to Design',
       '#E30613', 'Workflow', 'SALES',
       (SELECT id FROM public.departments WHERE key = 'sales'), 1
WHERE NOT EXISTS (SELECT 1 FROM public.task_types WHERE key = 'sales_to_design');

-- 10) BACKFILL memberships from user_roles
-- Sales roles → sales department
INSERT INTO public.department_memberships (department_id, user_id, role, is_primary, active)
SELECT
  (SELECT id FROM public.departments WHERE key = 'sales'),
  ur.user_id,
  CASE WHEN ur.role = 'sales_manager' THEN 'department_manager'::department_role
       ELSE 'employee'::department_role END,
  true,
  true
FROM public.user_roles ur
WHERE ur.role IN ('sales_manager','sales_executive')
ON CONFLICT (department_id, user_id) DO NOTHING;

-- Design roles → design department
INSERT INTO public.department_memberships (department_id, user_id, role, is_primary, active)
SELECT
  (SELECT id FROM public.departments WHERE key = 'design'),
  ur.user_id,
  CASE WHEN ur.role = 'design_manager' THEN 'department_manager'::department_role
       ELSE 'employee'::department_role END,
  true,
  true
FROM public.user_roles ur
WHERE ur.role IN ('design_manager','designer')
ON CONFLICT (department_id, user_id) DO NOTHING;

-- 11) BACKFILL task_assignments from tasks.sales_owner_id + designer_id
INSERT INTO public.task_assignments (task_id, user_id, department_id, role, is_primary, assigned_at, active)
SELECT t.id, t.sales_owner_id,
       (SELECT id FROM public.departments WHERE key = 'sales'),
       'owner'::assignment_role, true, t.created_at, true
FROM public.tasks t
WHERE t.sales_owner_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.task_assignments (task_id, user_id, department_id, role, is_primary, assigned_at, active)
SELECT t.id, t.designer_id,
       (SELECT id FROM public.departments WHERE key = 'design'),
       'assignee'::assignment_role, true, COALESCE(t.design_start_date::timestamptz, t.created_at), true
FROM public.tasks t
WHERE t.designer_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 12) BACKFILL tasks.department_id + task_type_id + workflow_kind + task_departments
UPDATE public.tasks
SET department_id  = (SELECT id FROM public.departments WHERE key = 'sales'),
    task_type_id   = (SELECT id FROM public.task_types  WHERE key = 'sales_to_design'),
    workflow_kind  = 'sales_to_design'
WHERE department_id IS NULL;

-- task_departments: sales (stage 1) + design (stage 2, current when designer set)
INSERT INTO public.task_departments (task_id, department_id, stage_order, is_current, entered_at)
SELECT t.id, (SELECT id FROM public.departments WHERE key = 'sales'), 1,
       (t.designer_id IS NULL), t.created_at
FROM public.tasks t
ON CONFLICT (task_id, department_id) DO NOTHING;

INSERT INTO public.task_departments (task_id, department_id, stage_order, is_current, entered_at)
SELECT t.id, (SELECT id FROM public.departments WHERE key = 'design'), 2,
       (t.designer_id IS NOT NULL AND t.overall_status <> 'مكتمل'),
       t.design_start_date::timestamptz
FROM public.tasks t
WHERE t.designer_id IS NOT NULL
ON CONFLICT (task_id, department_id) DO NOTHING;

-- 13) Assignment activity trigger
CREATE OR REPLACE FUNCTION public.log_assignment_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity(task_id, actor_id, action, details)
    VALUES (NEW.task_id, auth.uid(), 'assignment_added',
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role,
                         'department_id', NEW.department_id, 'is_primary', NEW.is_primary));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND (NEW.active IS DISTINCT FROM OLD.active OR NEW.role IS DISTINCT FROM OLD.role) THEN
    INSERT INTO public.task_activity(task_id, actor_id, action, details)
    VALUES (NEW.task_id, auth.uid(), 'assignment_updated',
      jsonb_build_object('user_id', NEW.user_id,
                         'from', jsonb_build_object('role', OLD.role, 'active', OLD.active),
                         'to',   jsonb_build_object('role', NEW.role, 'active', NEW.active)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.task_activity(task_id, actor_id, action, details)
    VALUES (OLD.task_id, auth.uid(), 'assignment_removed',
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_log_assignment ON public.task_assignments;
CREATE TRIGGER trg_log_assignment
  AFTER INSERT OR UPDATE OR DELETE ON public.task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_assignment_change();

-- 14) Prevent deleting department with tasks/members
CREATE OR REPLACE FUNCTION public.prevent_delete_department_with_data()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tasks WHERE department_id = OLD.id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.department_memberships WHERE department_id = OLD.id LIMIT 1)
     OR EXISTS (SELECT 1 FROM public.task_departments WHERE department_id = OLD.id LIMIT 1)
  THEN
    RAISE EXCEPTION 'لا يمكن حذف هذا القسم لوجود مستخدمين أو تاسكات مرتبطة به، يمكنك أرشفته بدلًا من ذلك.';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_prevent_delete_department ON public.departments;
CREATE TRIGGER trg_prevent_delete_department
  BEFORE DELETE ON public.departments FOR EACH ROW
  EXECUTE FUNCTION public.prevent_delete_department_with_data();

-- 15) Extended can_view_task
CREATE OR REPLACE FUNCTION public.can_view_task(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  t RECORD;
  ov_all text;
  ov_task text;
  ov_view_all_dept text;
BEGIN
  IF _user_id IS NULL OR _task_id IS NULL THEN RETURN false; END IF;

  -- 1) Explicit task-level override wins first
  SELECT value INTO ov_task
  FROM public.user_permission_overrides
  WHERE user_id = _user_id AND permission_key = 'view_task:' || _task_id::text
  LIMIT 1;
  IF ov_task = 'deny' THEN RETURN false; END IF;
  IF ov_task = 'allow' THEN RETURN true; END IF;

  -- 2) Super/System roles
  IF public.has_any_role(_user_id, ARRAY[
      'super_admin'::app_role, 'admin'::app_role,
      'sales_manager'::app_role, 'design_manager'::app_role
  ]) THEN
    RETURN true;
  END IF;

  -- 3) view_all_department_tasks override
  SELECT value INTO ov_view_all_dept
  FROM public.user_permission_overrides
  WHERE user_id = _user_id AND permission_key = 'view_all_department_tasks' AND value = 'allow'
  LIMIT 1;
  IF ov_view_all_dept = 'allow' THEN RETURN true; END IF;

  -- 4) Global view_all_tasks override
  SELECT value INTO ov_all
  FROM public.user_permission_overrides
  WHERE user_id = _user_id AND permission_key = 'view_all_tasks'
  LIMIT 1;
  IF ov_all = 'allow' THEN RETURN true; END IF;
  IF ov_all = 'deny'  THEN RETURN false; END IF;

  -- 5) Fetch task metadata
  SELECT sales_owner_id, designer_id, department_id INTO t
  FROM public.tasks WHERE id = _task_id;
  IF t IS NULL THEN RETURN false; END IF;

  -- 6) Legacy ownership (backward compat)
  IF t.sales_owner_id = _user_id OR t.designer_id = _user_id THEN
    RETURN true;
  END IF;

  -- 7) Active assignment on this task
  IF EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_id = _task_id AND user_id = _user_id AND active = true
  ) THEN
    RETURN true;
  END IF;

  -- 8) Department manager of any department linked to the task
  IF EXISTS (
    SELECT 1 FROM public.department_memberships dm
    WHERE dm.user_id = _user_id AND dm.active = true
      AND dm.role IN ('department_manager','department_supervisor')
      AND (
        dm.department_id = t.department_id
        OR dm.department_id IN (
          SELECT department_id FROM public.task_departments WHERE task_id = _task_id
        )
      )
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END $$;

-- Assignments RLS (uses can_view_task)
CREATE POLICY ta_select ON public.task_assignments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));
CREATE POLICY ta_manage ON public.task_assignments
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['sales_manager'::app_role,'design_manager'::app_role])
    OR EXISTS (
      SELECT 1 FROM public.user_permission_overrides
      WHERE user_id = auth.uid() AND permission_key = 'assign_department_tasks' AND value = 'allow'
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['sales_manager'::app_role,'design_manager'::app_role])
    OR EXISTS (
      SELECT 1 FROM public.user_permission_overrides
      WHERE user_id = auth.uid() AND permission_key = 'assign_department_tasks' AND value = 'allow'
    )
  );

CREATE POLICY td_select ON public.task_departments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));
CREATE POLICY td_manage ON public.task_departments
  FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['sales_manager'::app_role,'design_manager'::app_role])
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.has_any_role(auth.uid(), ARRAY['sales_manager'::app_role,'design_manager'::app_role])
  );
