
-- Backfill/maintain tasks.due_at from delivery_due_date (end of day Cairo = 21:00 UTC previous handling: use 20:59 UTC ~ midnight Cairo)
CREATE OR REPLACE FUNCTION public.set_task_due_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.delivery_due_date IS NOT NULL THEN
    -- End of delivery day in Africa/Cairo → UTC
    NEW.due_at := ((NEW.delivery_due_date + INTERVAL '1 day') AT TIME ZONE 'Africa/Cairo');
  ELSE
    NEW.due_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_due_at ON public.tasks;
CREATE TRIGGER trg_set_task_due_at
BEFORE INSERT OR UPDATE OF delivery_due_date ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.set_task_due_at();

-- Backfill existing rows
UPDATE public.tasks
SET due_at = ((delivery_due_date + INTERVAL '1 day') AT TIME ZONE 'Africa/Cairo')
WHERE delivery_due_date IS NOT NULL AND due_at IS NULL;

-- Notify on new comment
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT id, task_code, task_name, sales_owner_id, designer_id
  INTO t FROM public.tasks WHERE id = NEW.task_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications(user_id, task_id, title, body, kind, severity, data)
  SELECT DISTINCT uid, t.id,
    'تعليق جديد على تاسك',
    COALESCE(t.task_code,'') || ' — ' || t.task_name,
    'comment', 'normal',
    jsonb_build_object('task_code', t.task_code, 'comment_id', NEW.id, 'is_internal', NEW.is_internal)
  FROM (
    SELECT unnest(ARRAY[t.sales_owner_id, t.designer_id]) AS uid
    UNION
    SELECT user_id FROM public.user_roles WHERE role IN ('design_manager','sales_manager')
  ) r
  WHERE uid IS NOT NULL AND uid <> NEW.author_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.task_comments;
CREATE TRIGGER trg_notify_on_comment
AFTER INSERT ON public.task_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- Notify on new file
CREATE OR REPLACE FUNCTION public.notify_on_file()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT id, task_code, task_name, sales_owner_id, designer_id
  INTO t FROM public.tasks WHERE id = NEW.task_id;
  IF t.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.notifications(user_id, task_id, title, body, kind, severity, data)
  SELECT DISTINCT uid, t.id,
    'تم رفع ملف جديد',
    COALESCE(t.task_code,'') || ' — ' || NEW.file_name,
    'file', 'normal',
    jsonb_build_object('task_code', t.task_code, 'file_name', NEW.file_name, 'kind', NEW.kind)
  FROM (
    SELECT unnest(ARRAY[t.sales_owner_id, t.designer_id]) AS uid
    UNION
    SELECT user_id FROM public.user_roles WHERE role IN ('design_manager','sales_manager')
  ) r
  WHERE uid IS NOT NULL AND uid <> NEW.uploader_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_file ON public.task_attachments;
CREATE TRIGGER trg_notify_on_file
AFTER INSERT ON public.task_attachments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_file();

-- Notify on assignment / completion / status change
CREATE OR REPLACE FUNCTION public.notify_task_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Designer newly assigned
  IF NEW.designer_id IS DISTINCT FROM OLD.designer_id AND NEW.designer_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, task_id, title, body, kind, severity, data)
    VALUES (NEW.designer_id, NEW.id, 'تم تعيينك على تاسك',
      COALESCE(NEW.task_code,'') || ' — ' || NEW.task_name,
      'assignment', 'normal',
      jsonb_build_object('task_code', NEW.task_code, 'role', 'designer'));
  END IF;

  -- Sales owner newly assigned
  IF NEW.sales_owner_id IS DISTINCT FROM OLD.sales_owner_id AND NEW.sales_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, task_id, title, body, kind, severity, data)
    VALUES (NEW.sales_owner_id, NEW.id, 'تم تعيينك مسؤول مبيعات على تاسك',
      COALESCE(NEW.task_code,'') || ' — ' || NEW.task_name,
      'assignment', 'normal',
      jsonb_build_object('task_code', NEW.task_code, 'role', 'sales_owner'));
  END IF;

  -- Awaiting approval → notify sales owner
  IF NEW.overall_status IS DISTINCT FROM OLD.overall_status
     AND NEW.overall_status = 'بانتظار الاعتماد'::overall_status
     AND NEW.sales_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, task_id, title, body, kind, severity, data)
    VALUES (NEW.sales_owner_id, NEW.id, 'تاسك بانتظار اعتماد العميل',
      COALESCE(NEW.task_code,'') || ' — ' || NEW.task_name,
      'approval', 'normal',
      jsonb_build_object('task_code', NEW.task_code));
  END IF;

  -- Completed → notify sales owner
  IF NEW.overall_status IS DISTINCT FROM OLD.overall_status
     AND NEW.overall_status = 'مكتمل'::overall_status
     AND NEW.sales_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, task_id, title, body, kind, severity, data)
    VALUES (NEW.sales_owner_id, NEW.id, 'تم اكتمال التاسك',
      COALESCE(NEW.task_code,'') || ' — ' || NEW.task_name,
      'completed', 'normal',
      jsonb_build_object('task_code', NEW.task_code));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_events ON public.tasks;
CREATE TRIGGER trg_notify_task_events
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_events();
