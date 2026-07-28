
CREATE OR REPLACE FUNCTION public.touch_years_months_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_delete_year_with_tasks()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.prevent_delete_month_with_tasks()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
