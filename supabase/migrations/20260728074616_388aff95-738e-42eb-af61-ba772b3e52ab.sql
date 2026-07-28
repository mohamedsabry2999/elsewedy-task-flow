
-- ============ Field-level permission trigger ============
CREATE OR REPLACE FUNCTION public.enforce_task_field_permissions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  is_adm boolean;
  is_sm  boolean;
  is_se  boolean;
  is_dm  boolean;
  is_dsg boolean;
  is_sales_owner boolean;
  is_designer boolean;
  can_sales boolean;
  can_design boolean;
  can_status boolean;
BEGIN
  -- Skip enforcement when there is no auth context (service role / triggers)
  IF uid IS NULL THEN RETURN NEW; END IF;

  is_adm := public.is_admin(uid);
  IF is_adm THEN RETURN NEW; END IF;

  is_sm  := public.has_role(uid, 'sales_manager');
  is_se  := public.has_role(uid, 'sales_executive');
  is_dm  := public.has_role(uid, 'design_manager');
  is_dsg := public.has_role(uid, 'designer');

  is_sales_owner := (OLD.sales_owner_id = uid);
  is_designer    := (OLD.designer_id = uid);

  can_sales  := is_sm OR (is_se AND is_sales_owner);
  can_design := is_dm OR (is_dsg AND is_designer);
  can_status := is_sm OR is_dm OR (is_se AND is_sales_owner) OR (is_dsg AND is_designer);

  -- Sales-owned columns
  IF (NEW.customer_name    IS DISTINCT FROM OLD.customer_name)    AND NOT can_sales THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل بيانات المبيعات (اسم العميل)'; END IF;
  IF (NEW.sales_owner_id   IS DISTINCT FROM OLD.sales_owner_id)   AND NOT (is_sm) THEN
    RAISE EXCEPTION 'تعيين مسؤول السيلز يتطلب صلاحية مدير مبيعات'; END IF;
  IF (NEW.customer_type    IS DISTINCT FROM OLD.customer_type)    AND NOT can_sales THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل نوع العميل'; END IF;
  IF (NEW.products         IS DISTINCT FROM OLD.products)         AND NOT can_sales THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل المنتجات'; END IF;
  IF (NEW.order_details    IS DISTINCT FROM OLD.order_details)    AND NOT can_sales THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل تفاصيل الطلب'; END IF;
  IF (NEW.size_qty_material IS DISTINCT FROM OLD.size_qty_material) AND NOT can_sales THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل المقاس/الكمية/الخامة'; END IF;
  IF (NEW.design_brief     IS DISTINCT FROM OLD.design_brief)     AND NOT can_sales THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل ملخص التصميم'; END IF;
  IF (NEW.priority         IS DISTINCT FROM OLD.priority)         AND NOT (can_sales OR can_design) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل الأولوية'; END IF;
  IF (NEW.request_date     IS DISTINCT FROM OLD.request_date)     AND NOT can_sales THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل تاريخ الطلب'; END IF;

  -- Design-owned columns
  IF (NEW.designer_id       IS DISTINCT FROM OLD.designer_id)       AND NOT is_dm THEN
    RAISE EXCEPTION 'تعيين المصمم يتطلب صلاحية مدير التصميم'; END IF;
  IF (NEW.design_status     IS DISTINCT FROM OLD.design_status)     AND NOT can_design THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل حالة التصميم'; END IF;
  IF (NEW.design_start_date IS DISTINCT FROM OLD.design_start_date) AND NOT can_design THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل تاريخ بدء التصميم'; END IF;
  IF (NEW.delivery_due_date IS DISTINCT FROM OLD.delivery_due_date) AND NOT (can_sales OR can_design) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل موعد التسليم'; END IF;
  IF (NEW.designer_notes    IS DISTINCT FROM OLD.designer_notes)    AND NOT can_design THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل ملاحظات المصمم'; END IF;
  IF (NEW.sales_client_revisions IS DISTINCT FROM OLD.sales_client_revisions) AND NOT (can_sales OR can_design) THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل ملاحظات العميل'; END IF;
  IF (NEW.final_version_url IS DISTINCT FROM OLD.final_version_url) AND NOT can_design THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل رابط النسخة النهائية'; END IF;
  IF (NEW.files_url         IS DISTINCT FROM OLD.files_url)         AND NOT can_design THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل رابط ملفات التصميم'; END IF;
  IF (NEW.actual_delivery_date IS DISTINCT FROM OLD.actual_delivery_date) AND NOT can_design THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تعديل تاريخ التسليم الفعلي'; END IF;
  IF (NEW.delivered         IS DISTINCT FROM OLD.delivered)         AND NOT can_design THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تغيير حالة التسليم'; END IF;

  -- Overall status transitions
  IF (NEW.overall_status IS DISTINCT FROM OLD.overall_status) AND NOT can_status THEN
    RAISE EXCEPTION 'ليس لديك صلاحية تغيير الحالة العامة';
  END IF;

  -- Archive / restore
  IF (NEW.is_archived IS DISTINCT FROM OLD.is_archived) AND NOT (is_sm OR is_dm) THEN
    RAISE EXCEPTION 'أرشفة/استرجاع التاسك يتطلب صلاحية مدير';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_field_permissions ON public.tasks;
CREATE TRIGGER trg_enforce_task_field_permissions
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_field_permissions();

-- ============ Status transition validation ============
CREATE OR REPLACE FUNCTION public.validate_task_transitions()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  missing text[] := ARRAY[]::text[];
BEGIN
  IF NEW.overall_status IS DISTINCT FROM OLD.overall_status THEN
    IF NEW.overall_status = 'جاهز للتصميم' THEN
      IF coalesce(trim(NEW.customer_name),'') = '' THEN missing := missing || 'اسم العميل'; END IF;
      IF NEW.products IS NULL OR array_length(NEW.products,1) IS NULL THEN missing := missing || 'المنتج/الخدمة'; END IF;
      IF coalesce(trim(NEW.order_details),'') = '' THEN missing := missing || 'تفاصيل الطلب'; END IF;
      IF coalesce(trim(NEW.design_brief),'') = '' THEN missing := missing || 'المطلوب من التصميم'; END IF;
      IF NEW.delivery_due_date IS NULL THEN missing := missing || 'موعد التسليم'; END IF;
    ELSIF NEW.overall_status = 'قيد التصميم' THEN
      IF NEW.designer_id IS NULL THEN missing := missing || 'المصمم المسؤول'; END IF;
      IF NEW.design_start_date IS NULL THEN NEW.design_start_date := CURRENT_DATE; END IF;
    ELSIF NEW.overall_status = 'بانتظار الاعتماد' THEN
      IF coalesce(NEW.files_url,'') = '' AND coalesce(NEW.final_version_url,'') = '' THEN
        missing := missing || 'رابط ملف تصميم واحد على الأقل';
      END IF;
    ELSIF NEW.overall_status = 'مكتمل' THEN
      IF NEW.design_status <> 'معتمد' THEN missing := missing || 'حالة التصميم يجب أن تكون معتمد'; END IF;
      IF coalesce(NEW.final_version_url,'') = '' THEN missing := missing || 'رابط النسخة النهائية'; END IF;
      IF NEW.actual_delivery_date IS NULL THEN missing := missing || 'تاريخ التسليم الفعلي'; END IF;
      IF NEW.delivered = false THEN missing := missing || 'تفعيل مربع تم التسليم'; END IF;
    END IF;

    IF array_length(missing,1) IS NOT NULL THEN
      RAISE EXCEPTION 'لا يمكن الانتقال إلى الحالة %. مطلوب: %', NEW.overall_status, array_to_string(missing, ' • ');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_transitions ON public.tasks;
CREATE TRIGGER trg_validate_task_transitions
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_transitions();

-- ============ Attach the existing prevent-last-super-admin function ============
DROP TRIGGER IF EXISTS trg_prevent_last_super_admin_roles ON public.user_roles;
CREATE TRIGGER trg_prevent_last_super_admin_roles
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_super_admin_change();

DROP TRIGGER IF EXISTS trg_prevent_last_super_admin_profiles ON public.profiles;
CREATE TRIGGER trg_prevent_last_super_admin_profiles
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_last_super_admin_change();

-- Also attach task activity + notify triggers if missing (they exist as functions, but the DB report says no triggers).
DROP TRIGGER IF EXISTS trg_gen_task_code ON public.tasks;
CREATE TRIGGER trg_gen_task_code BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.gen_task_code();

DROP TRIGGER IF EXISTS trg_touch_tasks ON public.tasks;
CREATE TRIGGER trg_touch_tasks BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_log_task_activity ON public.tasks;
CREATE TRIGGER trg_log_task_activity AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.log_task_activity();

DROP TRIGGER IF EXISTS trg_notify_ready_for_design ON public.tasks;
CREATE TRIGGER trg_notify_ready_for_design AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_ready_for_design();

-- ============ Tighten notifications RLS ============
DROP POLICY IF EXISTS notif_insert_any_auth ON public.notifications;
CREATE POLICY notif_insert_self ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- ============ Indexes ============
CREATE INDEX IF NOT EXISTS idx_tasks_designer_id     ON public.tasks(designer_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sales_owner_id  ON public.tasks(sales_owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_overall_status  ON public.tasks(overall_status);
CREATE INDEX IF NOT EXISTS idx_tasks_month_code      ON public.tasks(month_code);
CREATE INDEX IF NOT EXISTS idx_task_activity_task    ON public.task_activity(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_comments_task    ON public.task_comments(task_id, created_at);
