
-- 1) New columns
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS delivery_due_time TIME,
  ADD COLUMN IF NOT EXISTS stop_reason TEXT,
  ADD COLUMN IF NOT EXISTS revision_note TEXT,
  ADD COLUMN IF NOT EXISTS reopen_note TEXT;

-- 2) Update set_task_due_at to combine date + time in Africa/Cairo
CREATE OR REPLACE FUNCTION public.set_task_due_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  t TIME;
BEGIN
  IF NEW.delivery_due_date IS NOT NULL THEN
    t := COALESCE(NEW.delivery_due_time, TIME '23:59');
    NEW.due_at := ((NEW.delivery_due_date + t) AT TIME ZONE 'Africa/Cairo');
  ELSE
    NEW.due_at := NULL;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Tighter validate_task_transitions
CREATE OR REPLACE FUNCTION public.validate_task_transitions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  missing text[] := ARRAY[]::text[];
  uid uuid := auth.uid();
  has_final_attachment boolean := false;
  has_any_attachment boolean := false;
BEGIN
  IF NEW.overall_status IS DISTINCT FROM OLD.overall_status THEN
    -- Ready for design
    IF NEW.overall_status = 'جاهز للتصميم' THEN
      IF coalesce(trim(NEW.customer_name),'') = '' THEN missing := missing || 'اسم العميل'; END IF;
      IF NEW.products IS NULL OR array_length(NEW.products,1) IS NULL THEN missing := missing || 'المنتج/الخدمة'; END IF;
      IF coalesce(trim(NEW.order_details),'') = '' THEN missing := missing || 'تفاصيل الطلب'; END IF;
      IF coalesce(trim(NEW.design_brief),'') = '' THEN missing := missing || 'المطلوب من التصميم'; END IF;
      IF NEW.delivery_due_date IS NULL THEN missing := missing || 'تاريخ التسليم'; END IF;
      IF NEW.delivery_due_time IS NULL THEN missing := missing || 'وقت التسليم'; END IF;

    ELSIF NEW.overall_status = 'قيد التصميم' THEN
      IF NEW.designer_id IS NULL THEN missing := missing || 'المصمم المسؤول'; END IF;
      IF NEW.design_start_date IS NULL THEN NEW.design_start_date := CURRENT_DATE; END IF;

    ELSIF NEW.overall_status = 'تعديلات' THEN
      IF coalesce(trim(NEW.revision_note),'') = ''
         AND coalesce(trim(NEW.sales_client_revisions),'') = '' THEN
        missing := missing || 'سبب/ملاحظة التعديل';
      END IF;

    ELSIF NEW.overall_status = 'متوقف' THEN
      IF coalesce(trim(NEW.stop_reason),'') = '' THEN
        missing := missing || 'سبب الإيقاف';
      END IF;

    ELSIF NEW.overall_status = 'بانتظار الاعتماد' THEN
      SELECT EXISTS(SELECT 1 FROM public.task_attachments WHERE task_id = NEW.id)
        INTO has_any_attachment;
      IF NOT has_any_attachment
         AND coalesce(NEW.files_url,'') = ''
         AND coalesce(NEW.final_version_url,'') = '' THEN
        missing := missing || 'ملف تصميم واحد على الأقل';
      END IF;

    ELSIF NEW.overall_status = 'مكتمل' THEN
      IF NEW.design_status <> 'معتمد' THEN missing := missing || 'حالة التصميم يجب أن تكون معتمد'; END IF;
      SELECT EXISTS(SELECT 1 FROM public.task_attachments WHERE task_id = NEW.id AND kind = 'final')
        INTO has_final_attachment;
      IF NOT has_final_attachment AND coalesce(NEW.final_version_url,'') = '' THEN
        missing := missing || 'مرفق نهائي أو رابط نسخة نهائية';
      END IF;
      IF NEW.actual_delivery_date IS NULL THEN missing := missing || 'تاريخ التسليم الفعلي'; END IF;
      IF NEW.delivered = false THEN missing := missing || 'تفعيل مربع تم التسليم'; END IF;
    END IF;

    -- Reopen from مكتمل
    IF OLD.overall_status = 'مكتمل' AND NEW.overall_status <> 'مكتمل' THEN
      IF coalesce(trim(NEW.reopen_note),'') = '' THEN
        missing := missing || 'سبب إعادة الفتح';
      END IF;
      IF uid IS NOT NULL AND NOT (
        public.is_admin(uid)
        OR public.has_any_role(uid, ARRAY['sales_manager'::app_role,'design_manager'::app_role])
      ) THEN
        RAISE EXCEPTION 'إعادة فتح التاسك المكتمل تتطلب صلاحية مدير أو أدمن';
      END IF;
    END IF;

    IF array_length(missing,1) IS NOT NULL THEN
      RAISE EXCEPTION 'لا يمكن الانتقال إلى الحالة %. مطلوب: %', NEW.overall_status, array_to_string(missing, ' • ');
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4) Log reason fields into task_activity
CREATE OR REPLACE FUNCTION public.log_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    IF NEW.delivery_due_time IS DISTINCT FROM OLD.delivery_due_time THEN
      changes := changes || jsonb_build_object('delivery_due_time',
        jsonb_build_object('from', OLD.delivery_due_time, 'to', NEW.delivery_due_time));
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
    IF NEW.stop_reason IS DISTINCT FROM OLD.stop_reason THEN
      changes := changes || jsonb_build_object('stop_reason',
        jsonb_build_object('from', OLD.stop_reason, 'to', NEW.stop_reason));
    END IF;
    IF NEW.revision_note IS DISTINCT FROM OLD.revision_note THEN
      changes := changes || jsonb_build_object('revision_note',
        jsonb_build_object('from', OLD.revision_note, 'to', NEW.revision_note));
    END IF;
    IF NEW.reopen_note IS DISTINCT FROM OLD.reopen_note THEN
      changes := changes || jsonb_build_object('reopen_note',
        jsonb_build_object('from', OLD.reopen_note, 'to', NEW.reopen_note));
    END IF;
    IF changes <> '{}'::jsonb THEN
      INSERT INTO public.task_activity(task_id, actor_id, action, details)
      VALUES (NEW.id, auth.uid(), 'updated', changes);
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;
