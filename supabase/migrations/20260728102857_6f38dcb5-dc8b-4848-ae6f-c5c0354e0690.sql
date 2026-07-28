
DO $$
DECLARE
  default_cols JSONB := '[
    {"key":"task_code","label_ar":"كود المهمة","visible":true,"order":1,"width":120,"pinned":true},
    {"key":"task_name","label_ar":"اسم المهمة","visible":true,"order":2,"width":220},
    {"key":"customer_name","label_ar":"العميل","visible":true,"order":3,"width":180},
    {"key":"customer_type","label_ar":"نوع العميل","visible":false,"order":4,"width":120},
    {"key":"products","label_ar":"المنتج/الخدمة","visible":true,"order":5,"width":160},
    {"key":"overall_status","label_ar":"الحالة العامة","visible":true,"order":6,"width":140},
    {"key":"design_status","label_ar":"حالة التصميم","visible":true,"order":7,"width":140},
    {"key":"priority","label_ar":"الأولوية","visible":true,"order":8,"width":100},
    {"key":"sales_owner","label_ar":"مسؤول المبيعات","visible":true,"order":9,"width":160},
    {"key":"designer","label_ar":"المصمم","visible":true,"order":10,"width":160},
    {"key":"request_date","label_ar":"تاريخ الطلب","visible":false,"order":11,"width":120},
    {"key":"delivery_due_date","label_ar":"موعد التسليم","visible":true,"order":12,"width":140},
    {"key":"actual_delivery_date","label_ar":"تاريخ التسليم الفعلي","visible":false,"order":13,"width":140},
    {"key":"delivered","label_ar":"تم التسليم","visible":false,"order":14,"width":90},
    {"key":"design_start_date","label_ar":"بدء التصميم","visible":false,"order":15,"width":120},
    {"key":"created_at","label_ar":"تاريخ الإنشاء","visible":false,"order":16,"width":140}
  ]'::jsonb;
BEGIN
  -- Seed system default
  UPDATE public.task_templates
     SET columns_config = default_cols
   WHERE is_system_default = true
     AND (columns_config IS NULL OR jsonb_array_length(columns_config) = 0);

  -- Propagate to all templates without configured columns
  UPDATE public.task_templates
     SET columns_config = default_cols
   WHERE columns_config IS NULL OR jsonb_array_length(columns_config) = 0;
END $$;
