
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'super_admin','admin','sales_manager','sales_executive',
  'design_manager','designer','view_only'
);

CREATE TYPE public.overall_status AS ENUM (
  'جديد','عند السيلز','جاهز للتصميم','قيد التصميم','تعديلات','بانتظار الاعتماد','مكتمل','متوقف'
);

CREATE TYPE public.design_status AS ENUM (
  'لم يبدأ','قيد التنفيذ','مراجعة داخلية','تعديلات','بانتظار الاعتماد','معتمد','متوقف'
);

CREATE TYPE public.priority AS ENUM ('عاجل','عالية','متوسطة','عادية');
CREATE TYPE public.customer_type AS ENUM ('عميل حالي','عميل جديد','عميل محتمل');
CREATE TYPE public.product_service AS ENUM (
  'طباعة ديجيتال','طباعة أوفست','علب وتغليف','ليبل واستيكر',
  'بروشور وكتالوج','شيتات 50×70','أخرى'
);

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- USER ROLES
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('super_admin','admin'));
$$;

-- Profiles policies
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_insert_self_or_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- User roles policies
CREATE POLICY "roles_select_all_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================
-- TASKS
-- =========================================================
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_code TEXT UNIQUE,
  month_code TEXT NOT NULL, -- AUG, SEP, OCT, NOV, DEC
  task_name TEXT NOT NULL,
  overall_status overall_status NOT NULL DEFAULT 'جديد',

  -- Sales fields
  customer_name TEXT NOT NULL DEFAULT '',
  sales_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_type customer_type,
  products product_service[] NOT NULL DEFAULT '{}',
  order_details TEXT,
  size_qty_material TEXT,
  design_brief TEXT,
  priority priority NOT NULL DEFAULT 'عادية',
  request_date DATE,

  -- Design fields
  designer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  design_status design_status NOT NULL DEFAULT 'لم يبدأ',
  design_start_date DATE,
  delivery_due_date DATE,
  files_url TEXT,
  designer_notes TEXT,
  sales_client_revisions TEXT,
  final_version_url TEXT,
  actual_delivery_date DATE,
  delivered BOOLEAN NOT NULL DEFAULT false,

  -- Checklists
  sales_checklist JSONB NOT NULL DEFAULT '{"customer_data":false,"size_qty_material":false,"design_brief":false,"deadline_priority":false,"reference_files":false}'::jsonb,
  design_checklist JSONB NOT NULL DEFAULT '{"brief_received":false,"execution_started":false,"revisions_logged":false,"final_approved":false,"final_uploaded":false}'::jsonb,

  -- Meta
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Everyone signed-in can read non-deleted tasks
CREATE POLICY "tasks_select_auth" ON public.tasks FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- Sales roles + admins insert
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','admin','sales_manager','sales_executive']::app_role[])
  );

-- Update: admins full; sales own; design roles on any
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR (public.has_role(auth.uid(),'sales_manager'))
    OR (public.has_role(auth.uid(),'sales_executive') AND sales_owner_id = auth.uid())
    OR (public.has_any_role(auth.uid(), ARRAY['design_manager','designer']::app_role[]))
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR (public.has_role(auth.uid(),'sales_manager'))
    OR (public.has_role(auth.uid(),'sales_executive') AND sales_owner_id = auth.uid())
    OR (public.has_any_role(auth.uid(), ARRAY['design_manager','designer']::app_role[]))
  );

-- Delete: super admins only
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'));

-- =========================================================
-- TASK CODE AUTO-GENERATION
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.task_code_seq;

CREATE OR REPLACE FUNCTION public.gen_task_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n BIGINT;
BEGIN
  IF NEW.task_code IS NULL THEN
    n := nextval('public.task_code_seq');
    NEW.task_code := NEW.month_code || '-' || LPAD(n::text, 4, '0');
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_gen_code BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.gen_task_code();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================================
-- COMMENTS
-- =========================================================
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert" ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_update_own" ON public.task_comments FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "comments_delete_own_or_admin" ON public.task_comments FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin(auth.uid()));

-- =========================================================
-- ATTACHMENTS
-- =========================================================
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'reference', -- reference | final | other
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attachments_select" ON public.task_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "attachments_insert" ON public.task_attachments FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid());
CREATE POLICY "attachments_delete_own_or_admin" ON public.task_attachments FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_admin(auth.uid()));

-- =========================================================
-- ACTIVITY LOG
-- =========================================================
CREATE TABLE public.task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.task_activity TO authenticated;
GRANT ALL ON public.task_activity TO service_role;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_select" ON public.task_activity FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_insert" ON public.task_activity FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE TRIGGER trg_tasks_activity_ins AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();
CREATE TRIGGER trg_tasks_activity_upd AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_insert_any_auth" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Notify design managers when a task becomes "جاهز للتصميم"
CREATE OR REPLACE FUNCTION public.notify_ready_for_design()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.overall_status = 'جاهز للتصميم'::overall_status
     AND (TG_OP = 'INSERT' OR OLD.overall_status IS DISTINCT FROM NEW.overall_status) THEN
    INSERT INTO public.notifications(user_id, task_id, title, body)
    SELECT ur.user_id, NEW.id, 'تاسك جديد جاهز للتصميم',
           NEW.task_code || ' — ' || NEW.task_name
    FROM public.user_roles ur
    WHERE ur.role IN ('design_manager','designer');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ready_ins AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_ready_for_design();
CREATE TRIGGER trg_notify_ready_upd AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_ready_for_design();

-- =========================================================
-- Auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  -- default role: view_only unless overridden
  INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'view_only')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX idx_tasks_month ON public.tasks(month_code);
CREATE INDEX idx_tasks_overall ON public.tasks(overall_status);
CREATE INDEX idx_tasks_sales_owner ON public.tasks(sales_owner_id);
CREATE INDEX idx_tasks_designer ON public.tasks(designer_id);
CREATE INDEX idx_tasks_deleted ON public.tasks(deleted_at);
