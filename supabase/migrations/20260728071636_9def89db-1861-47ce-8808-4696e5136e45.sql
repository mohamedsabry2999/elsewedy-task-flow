
-- 1) profiles: add missing member directory fields (additive)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS branch text,
  ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- 2) task_comments extensions
ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- 3) task_attachments extensions
ALTER TABLE public.task_attachments
  ADD COLUMN IF NOT EXISTS file_size bigint,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

-- 4) user_permission_overrides table
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL,
  value text NOT NULL, -- 'allow','own','read','deny'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission_key)
);

GRANT SELECT ON public.user_permission_overrides TO authenticated;
GRANT ALL ON public.user_permission_overrides TO service_role;

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upo_select_self_or_admin" ON public.user_permission_overrides;
CREATE POLICY "upo_select_self_or_admin"
  ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "upo_write_admin_only" ON public.user_permission_overrides;
CREATE POLICY "upo_write_admin_only"
  ON public.user_permission_overrides
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS user_permission_overrides_user_idx
  ON public.user_permission_overrides(user_id);

-- 5) Prevent removing/disabling the last active super admin
CREATE OR REPLACE FUNCTION public.prevent_last_super_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_super_admins int;
BEGIN
  -- Count active super admins EXCLUDING the row being changed
  IF TG_TABLE_NAME = 'user_roles' THEN
    IF (TG_OP = 'DELETE' AND OLD.role = 'super_admin') OR
       (TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM 'super_admin') THEN
      SELECT count(*) INTO active_super_admins
      FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'super_admin'
        AND ur.id <> OLD.id
        AND COALESCE(p.is_active, true) = true
        AND p.archived_at IS NULL;
      IF active_super_admins = 0 THEN
        RAISE EXCEPTION 'لا يمكن حذف أو تعديل آخر سوبر أدمن نشط';
      END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'profiles' THEN
    IF TG_OP = 'UPDATE' AND (
       (OLD.is_active = true AND NEW.is_active = false) OR
       (OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL)
    ) THEN
      IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.id AND role = 'super_admin') THEN
        SELECT count(*) INTO active_super_admins
        FROM public.user_roles ur
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.role = 'super_admin'
          AND p.id <> OLD.id
          AND COALESCE(p.is_active, true) = true
          AND p.archived_at IS NULL;
        IF active_super_admins = 0 THEN
          RAISE EXCEPTION 'لا يمكن إيقاف أو أرشفة آخر سوبر أدمن نشط';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_last_super_admin_user_roles ON public.user_roles;
CREATE TRIGGER trg_prevent_last_super_admin_user_roles
  BEFORE DELETE OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_super_admin_change();

DROP TRIGGER IF EXISTS trg_prevent_last_super_admin_profiles ON public.profiles;
CREATE TRIGGER trg_prevent_last_super_admin_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_last_super_admin_change();

-- 6) Extend activity trigger to log more diffs (priority, due date, delivery, final URL, delivered)
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changes JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_activity(task_id, actor_id, action, details)
    VALUES (NEW.id, auth.uid(), 'created',
      jsonb_build_object('task_code', NEW.task_code, 'task_name', NEW.task_name));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.overall_status IS DISTINCT FROM OLD.overall_status THEN
      changes := changes || jsonb_build_object('overall_status',
        jsonb_build_object('from', OLD.overall_status, 'to', NEW.overall_status));
    END IF;
    IF NEW.design_status IS DISTINCT FROM OLD.design_status THEN
      changes := changes || jsonb_build_object('design_status',
        jsonb_build_object('from', OLD.design_status, 'to', NEW.design_status));
    END IF;
    IF NEW.designer_id IS DISTINCT FROM OLD.designer_id THEN
      changes := changes || jsonb_build_object('designer_id',
        jsonb_build_object('from', OLD.designer_id, 'to', NEW.designer_id));
    END IF;
    IF NEW.sales_owner_id IS DISTINCT FROM OLD.sales_owner_id THEN
      changes := changes || jsonb_build_object('sales_owner_id',
        jsonb_build_object('from', OLD.sales_owner_id, 'to', NEW.sales_owner_id));
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      changes := changes || jsonb_build_object('priority',
        jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
    END IF;
    IF NEW.delivery_due_date IS DISTINCT FROM OLD.delivery_due_date THEN
      changes := changes || jsonb_build_object('delivery_due_date',
        jsonb_build_object('from', OLD.delivery_due_date, 'to', NEW.delivery_due_date));
    END IF;
    IF NEW.actual_delivery_date IS DISTINCT FROM OLD.actual_delivery_date THEN
      changes := changes || jsonb_build_object('actual_delivery_date',
        jsonb_build_object('from', OLD.actual_delivery_date, 'to', NEW.actual_delivery_date));
    END IF;
    IF NEW.delivered IS DISTINCT FROM OLD.delivered THEN
      changes := changes || jsonb_build_object('delivered',
        jsonb_build_object('from', OLD.delivered, 'to', NEW.delivered));
    END IF;
    IF NEW.final_version_url IS DISTINCT FROM OLD.final_version_url THEN
      changes := changes || jsonb_build_object('final_version_url',
        jsonb_build_object('from', OLD.final_version_url, 'to', NEW.final_version_url));
    END IF;
    IF NEW.is_archived IS DISTINCT FROM OLD.is_archived THEN
      changes := changes || jsonb_build_object('is_archived',
        jsonb_build_object('from', OLD.is_archived, 'to', NEW.is_archived));
    END IF;
    IF changes <> '{}'::jsonb THEN
      INSERT INTO public.task_activity(task_id, actor_id, action, details)
      VALUES (NEW.id, auth.uid(), 'updated', changes);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 7) Helpful indexes
CREATE INDEX IF NOT EXISTS tasks_designer_idx ON public.tasks(designer_id);
CREATE INDEX IF NOT EXISTS tasks_sales_owner_idx ON public.tasks(sales_owner_id);
CREATE INDEX IF NOT EXISTS tasks_overall_status_idx ON public.tasks(overall_status);
CREATE INDEX IF NOT EXISTS task_activity_task_created_idx ON public.task_activity(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON public.task_comments(task_id, created_at);
