-- =========================================
-- PHASE 2: TASK TEMPLATES (per-month, cloned from source)
-- =========================================

CREATE TABLE IF NOT EXISTS public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_system_default BOOLEAN NOT NULL DEFAULT false,
  cloned_from_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL,
  -- Reserved config columns for later phases (columns/fields/statuses).
  columns_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  fields_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  statuses_config JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.task_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.task_templates TO authenticated;
GRANT ALL ON public.task_templates TO service_role;

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY tpl_select_all ON public.task_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY tpl_insert_manage ON public.task_templates
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_structure(auth.uid()));
CREATE POLICY tpl_update_manage ON public.task_templates
  FOR UPDATE TO authenticated
  USING (public.can_manage_structure(auth.uid()))
  WITH CHECK (public.can_manage_structure(auth.uid()));
CREATE POLICY tpl_delete_manage ON public.task_templates
  FOR DELETE TO authenticated USING (public.can_manage_structure(auth.uid()));

CREATE TRIGGER trg_task_templates_touch
  BEFORE UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Only one system-default template at a time.
CREATE OR REPLACE FUNCTION public.enforce_single_default_template()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_system_default THEN
    UPDATE public.task_templates SET is_system_default = false
     WHERE id <> NEW.id AND is_system_default = true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_task_templates_default
  AFTER INSERT OR UPDATE OF is_system_default ON public.task_templates
  FOR EACH ROW WHEN (NEW.is_system_default = true)
  EXECUTE FUNCTION public.enforce_single_default_template();

-- Attach templates to months.
ALTER TABLE public.months
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.task_templates(id) ON DELETE SET NULL;

-- Seed a system default template so future months have something to clone from.
INSERT INTO public.task_templates (name, description, is_system_default)
SELECT 'القالب الافتراضي', 'قالب النظام الأساسي — يُستخدم عند إنشاء شهور جديدة بدون تحديد مصدر.', true
WHERE NOT EXISTS (SELECT 1 FROM public.task_templates WHERE is_system_default = true);

-- Helper: clone a template's config into a new template.
CREATE OR REPLACE FUNCTION public.clone_task_template(
  _source_id UUID, _name TEXT, _actor UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_id UUID;
  src RECORD;
BEGIN
  IF _source_id IS NULL THEN
    -- Fall back to system default.
    SELECT * INTO src FROM public.task_templates WHERE is_system_default = true LIMIT 1;
  ELSE
    SELECT * INTO src FROM public.task_templates WHERE id = _source_id;
  END IF;

  IF src.id IS NULL THEN
    -- Create a minimal empty template as last resort.
    INSERT INTO public.task_templates (name, description, created_by)
    VALUES (_name, NULL, _actor) RETURNING id INTO new_id;
    RETURN new_id;
  END IF;

  INSERT INTO public.task_templates
    (name, description, cloned_from_id, columns_config, fields_config, statuses_config, created_by)
  VALUES
    (_name, src.description, src.id, src.columns_config, src.fields_config, src.statuses_config, _actor)
  RETURNING id INTO new_id;

  RETURN new_id;
END $$;

GRANT EXECUTE ON FUNCTION public.clone_task_template(UUID, TEXT, UUID) TO authenticated;

-- Backfill: every existing month gets its own cloned template from the system default.
DO $$
DECLARE
  m RECORD;
  default_id UUID;
  new_tpl UUID;
BEGIN
  SELECT id INTO default_id FROM public.task_templates WHERE is_system_default = true LIMIT 1;
  IF default_id IS NULL THEN RETURN; END IF;

  FOR m IN SELECT id, name_ar, year_id FROM public.months WHERE template_id IS NULL LOOP
    INSERT INTO public.task_templates (name, description, cloned_from_id, created_by)
    VALUES (
      'قالب ' || m.name_ar,
      'قالب مُنشأ تلقائيًا للشهر.',
      default_id,
      NULL
    ) RETURNING id INTO new_tpl;
    UPDATE public.months SET template_id = new_tpl WHERE id = m.id;
  END LOOP;
END $$;
