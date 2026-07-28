
-- ============ 1) YEARS ============
CREATE TABLE IF NOT EXISTS public.years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL UNIQUE CHECK (year BETWEEN 2000 AND 2100),
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  sort_desc boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.years TO authenticated;
GRANT ALL ON public.years TO service_role;
ALTER TABLE public.years ENABLE ROW LEVEL SECURITY;

-- ============ 2) MONTHS ============
CREATE TABLE IF NOT EXISTS public.months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_id uuid NOT NULL REFERENCES public.years(id) ON DELETE RESTRICT,
  month_num smallint NOT NULL CHECK (month_num BETWEEN 1 AND 12),
  name_ar text NOT NULL,
  month_code text,                       -- legacy compat (AUG/SEP/...)
  slug text,                             -- URL slug (english)
  emoji text,
  verse text,
  verse_ref text,
  line text,
  is_hidden boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year_id, month_num)
);
CREATE INDEX IF NOT EXISTS months_year_idx ON public.months(year_id);
CREATE INDEX IF NOT EXISTS months_code_idx ON public.months(month_code) WHERE month_code IS NOT NULL;
GRANT SELECT ON public.months TO authenticated;
GRANT ALL ON public.months TO service_role;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;

-- ============ 3) STRUCTURE AUDIT LOG ============
CREATE TABLE IF NOT EXISTS public.structure_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,          -- 'create'|'update'|'archive'|'restore'|'delete'|'set_default'|'bulk_seed'
  entity_type text NOT NULL,     -- 'year'|'month'|'template'|'column'|'status'|'option'
  entity_id uuid,
  before jsonb,
  after jsonb,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sal_created_idx ON public.structure_audit_log(created_at DESC);
GRANT SELECT, INSERT ON public.structure_audit_log TO authenticated;
GRANT ALL ON public.structure_audit_log TO service_role;
ALTER TABLE public.structure_audit_log ENABLE ROW LEVEL SECURITY;

-- ============ 4) HELPER FUNCTION ============
CREATE OR REPLACE FUNCTION public.can_manage_structure(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND (
      public.is_admin(_user_id)
      OR EXISTS (
        SELECT 1 FROM public.user_permission_overrides
        WHERE user_id = _user_id
          AND permission_key = 'manage_task_structure'
          AND value = 'allow'
      )
    );
$$;

-- ============ 5) RLS POLICIES ============
DROP POLICY IF EXISTS years_select_auth ON public.years;
CREATE POLICY years_select_auth ON public.years
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS years_manage ON public.years;
CREATE POLICY years_manage ON public.years
  FOR ALL TO authenticated
  USING (public.can_manage_structure(auth.uid()))
  WITH CHECK (public.can_manage_structure(auth.uid()));

DROP POLICY IF EXISTS months_select_auth ON public.months;
CREATE POLICY months_select_auth ON public.months
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS months_manage ON public.months;
CREATE POLICY months_manage ON public.months
  FOR ALL TO authenticated
  USING (public.can_manage_structure(auth.uid()))
  WITH CHECK (public.can_manage_structure(auth.uid()));

DROP POLICY IF EXISTS sal_select ON public.structure_audit_log;
CREATE POLICY sal_select ON public.structure_audit_log
  FOR SELECT TO authenticated USING (public.can_manage_structure(auth.uid()));

DROP POLICY IF EXISTS sal_insert ON public.structure_audit_log;
CREATE POLICY sal_insert ON public.structure_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_structure(auth.uid()) AND actor_id = auth.uid());
-- No UPDATE / DELETE policies => immutable.

-- ============ 6) TRIGGERS ============
CREATE OR REPLACE FUNCTION public.touch_years_months_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_years_touch ON public.years;
CREATE TRIGGER trg_years_touch BEFORE UPDATE ON public.years
  FOR EACH ROW EXECUTE FUNCTION public.touch_years_months_updated_at();

DROP TRIGGER IF EXISTS trg_months_touch ON public.months;
CREATE TRIGGER trg_months_touch BEFORE UPDATE ON public.months
  FOR EACH ROW EXECUTE FUNCTION public.touch_years_months_updated_at();

-- Enforce single default year
CREATE OR REPLACE FUNCTION public.enforce_single_default_year()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_default IS TRUE THEN
    UPDATE public.years SET is_default = false WHERE id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_years_single_default ON public.years;
CREATE TRIGGER trg_years_single_default AFTER INSERT OR UPDATE OF is_default ON public.years
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_year();

-- Enforce single default month per year
CREATE OR REPLACE FUNCTION public.enforce_single_default_month()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_default IS TRUE THEN
    UPDATE public.months SET is_default = false
      WHERE year_id = NEW.year_id AND id <> NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_months_single_default ON public.months;
CREATE TRIGGER trg_months_single_default AFTER INSERT OR UPDATE OF is_default ON public.months
  FOR EACH ROW WHEN (NEW.is_default = true)
  EXECUTE FUNCTION public.enforce_single_default_month();

-- Prevent deleting year/month that has tasks
CREATE OR REPLACE FUNCTION public.prevent_delete_year_with_tasks()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.months m ON m.year_id = OLD.id
    WHERE t.month_id = m.id OR t.month_code = m.month_code
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف هذه السنة لأنها تحتوي على تاسكات، يمكنك أرشفتها بدلًا من ذلك.';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_years_no_delete_with_tasks ON public.years;
CREATE TRIGGER trg_years_no_delete_with_tasks BEFORE DELETE ON public.years
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_year_with_tasks();

CREATE OR REPLACE FUNCTION public.prevent_delete_month_with_tasks()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.month_id = OLD.id
       OR (OLD.month_code IS NOT NULL AND t.month_code = OLD.month_code)
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف هذا الشهر لأنه يحتوي على تاسكات، يمكنك أرشفته بدلًا من ذلك.';
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_months_no_delete_with_tasks ON public.months;
CREATE TRIGGER trg_months_no_delete_with_tasks BEFORE DELETE ON public.months
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_month_with_tasks();

-- ============ 7) TASKS: month_id (optional, kept in sync) ============
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS month_id uuid REFERENCES public.months(id);
CREATE INDEX IF NOT EXISTS tasks_month_id_idx ON public.tasks(month_id);

-- ============ 8) BACKFILL: seed 2026 + months AUG..DEC linked to existing tasks ============
DO $$
DECLARE
  v_year_id uuid;
  v_month record;
  v_codes text[] := ARRAY['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  v_names text[] := ARRAY['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  v_slugs text[] := ARRAY['january','february','march','april','may','june','july','august','september','october','november','december'];
  v_existing text[] := ARRAY['AUG','SEP','OCT','NOV','DEC'];
  v_emoji text; v_verse text; v_ref text; v_line text; v_default boolean; v_m_id uuid; v_code text; v_num int;
BEGIN
  -- Only seed once
  IF NOT EXISTS (SELECT 1 FROM public.years WHERE year = 2026) THEN
    INSERT INTO public.years(year, is_active, is_default, is_archived)
    VALUES (2026, true, true, false)
    RETURNING id INTO v_year_id;

    -- Insert the five existing months with their curated content
    FOR i IN 1..array_length(v_existing,1) LOOP
      v_code := v_existing[i];
      v_num := CASE v_code
        WHEN 'AUG' THEN 8 WHEN 'SEP' THEN 9 WHEN 'OCT' THEN 10
        WHEN 'NOV' THEN 11 WHEN 'DEC' THEN 12 END;

      SELECT
        CASE v_code
          WHEN 'AUG' THEN '🚀' WHEN 'SEP' THEN '🎯' WHEN 'OCT' THEN '⚙️'
          WHEN 'NOV' THEN '🏆' WHEN 'DEC' THEN '✨' END,
        CASE v_code
          WHEN 'AUG' THEN '﴿وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَى﴾'
          WHEN 'SEP' THEN '﴿إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ﴾'
          WHEN 'OCT' THEN '﴿فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ﴾'
          WHEN 'NOV' THEN '﴿إِنَّ مَعَ الْعُسْرِ يُسْرًا﴾'
          WHEN 'DEC' THEN '﴿وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ﴾' END,
        CASE v_code
          WHEN 'AUG' THEN 'سورة النجم — الآية 39'
          WHEN 'SEP' THEN 'سورة التوبة — الآية 120'
          WHEN 'OCT' THEN 'سورة آل عمران — الآية 159'
          WHEN 'NOV' THEN 'سورة الشرح — الآية 6'
          WHEN 'DEC' THEN 'سورة الطلاق — الآية 3' END,
        CASE v_code
          WHEN 'AUG' THEN 'ابدأ بقوة… فوضوح البداية يصنع جودة النهاية.'
          WHEN 'SEP' THEN 'كل تاسك مكتمل في موعده خطوة جديدة نحو ثقة أقوى مع العميل.'
          WHEN 'OCT' THEN 'الالتزام في التفاصيل هو ما يحول الشغل العادي إلى نتيجة تليق باسم السويدي.'
          WHEN 'NOV' THEN 'ضغط الشغل لا يعطل الفريق المنظم، بل يظهر قوته.'
          WHEN 'DEC' THEN 'اختم العام بما يثبت أن النجاح نتيجة عمل مستمر لا لحظة عابرة.' END
      INTO v_emoji, v_verse, v_ref, v_line;

      INSERT INTO public.months(
        year_id, month_num, name_ar, month_code, slug, emoji, verse, verse_ref, line, is_default
      ) VALUES (
        v_year_id, v_num, v_names[v_num], v_code, v_slugs[v_num],
        v_emoji, v_verse, v_ref, v_line,
        (v_code = 'AUG')  -- default month = first active month
      );
    END LOOP;

    -- Backfill month_id on existing tasks using month_code
    UPDATE public.tasks t
    SET month_id = m.id
    FROM public.months m
    WHERE m.year_id = v_year_id
      AND t.month_code = m.month_code
      AND t.month_id IS NULL;
  END IF;
END $$;
