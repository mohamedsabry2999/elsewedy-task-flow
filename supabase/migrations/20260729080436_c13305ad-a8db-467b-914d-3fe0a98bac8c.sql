
-- 1) Column linking each department to its own default template.
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS default_template_id uuid
    REFERENCES public.task_templates(id) ON DELETE SET NULL;

-- 2) Trigger: auto-clone system default template when a department is inserted.
CREATE OR REPLACE FUNCTION public.ensure_department_template()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tpl uuid;
BEGIN
  IF NEW.default_template_id IS NULL THEN
    new_tpl := public.clone_task_template(NULL, 'قالب — ' || NEW.name_ar, NEW.created_by);
    NEW.default_template_id := new_tpl;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_department_template ON public.departments;
CREATE TRIGGER trg_ensure_department_template
BEFORE INSERT ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.ensure_department_template();

-- 3) Backfill: clone template for existing departments missing one.
DO $$
DECLARE
  d RECORD;
  new_tpl uuid;
BEGIN
  FOR d IN SELECT id, name_ar, created_by FROM public.departments WHERE default_template_id IS NULL LOOP
    new_tpl := public.clone_task_template(NULL, 'قالب — ' || d.name_ar, d.created_by);
    UPDATE public.departments SET default_template_id = new_tpl WHERE id = d.id;
  END LOOP;
END $$;
