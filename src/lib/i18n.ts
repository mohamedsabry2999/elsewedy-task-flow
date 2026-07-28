// Arabic labels & option lists for Elsewedy Task Flow.

export const OVERALL_STATUS = [
  "جديد",
  "عند السيلز",
  "جاهز للتصميم",
  "قيد التصميم",
  "تعديلات",
  "بانتظار الاعتماد",
  "مكتمل",
  "متوقف",
] as const;
export type OverallStatus = (typeof OVERALL_STATUS)[number];

export const DESIGN_STATUS = [
  "لم يبدأ",
  "قيد التنفيذ",
  "مراجعة داخلية",
  "تعديلات",
  "بانتظار الاعتماد",
  "معتمد",
  "متوقف",
] as const;
export type DesignStatus = (typeof DESIGN_STATUS)[number];

export const PRIORITY = ["عاجل", "عالية", "متوسطة", "عادية"] as const;
export type Priority = (typeof PRIORITY)[number];

export const CUSTOMER_TYPE = ["عميل حالي", "عميل جديد", "عميل محتمل"] as const;
export type CustomerType = (typeof CUSTOMER_TYPE)[number];

export const PRODUCT_SERVICE = [
  "طباعة ديجيتال",
  "طباعة أوفست",
  "علب وتغليف",
  "ليبل واستيكر",
  "بروشور وكتالوج",
  "شيتات 50×70",
  "أخرى",
] as const;
export type ProductService = (typeof PRODUCT_SERVICE)[number];

export const ROLES = [
  "super_admin",
  "admin",
  "sales_manager",
  "sales_executive",
  "design_manager",
  "designer",
  "view_only",
] as const;
export type AppRole = (typeof ROLES)[number];

export const ROLE_LABEL: Record<AppRole, string> = {
  super_admin: "سوبر أدمن",
  admin: "أدمن",
  sales_manager: "مدير سيلز",
  sales_executive: "مندوب سيلز",
  design_manager: "مدير تصميم",
  designer: "مصمم",
  view_only: "مشاهدة فقط",
};

export const MONTHS = [
  { code: "AUG", label: "أغسطس 2026", slug: "august", emoji: "🚀",
    verse: "﴿وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَى﴾", ref: "سورة النجم — الآية 39",
    line: "ابدأ بقوة… فوضوح البداية يصنع جودة النهاية." },
  { code: "SEP", label: "سبتمبر 2026", slug: "september", emoji: "🎯",
    verse: "﴿إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ﴾", ref: "سورة التوبة — الآية 120",
    line: "كل تاسك مكتمل في موعده خطوة جديدة نحو ثقة أقوى مع العميل." },
  { code: "OCT", label: "أكتوبر 2026", slug: "october", emoji: "⚙️",
    verse: "﴿فَإِذَا عَزَمْتَ فَتَوَكَّلْ عَلَى اللَّهِ﴾", ref: "سورة آل عمران — الآية 159",
    line: "الالتزام في التفاصيل هو ما يحول الشغل العادي إلى نتيجة تليق باسم السويدي." },
  { code: "NOV", label: "نوفمبر 2026", slug: "november", emoji: "🏆",
    verse: "﴿إِنَّ مَعَ الْعُسْرِ يُسْرًا﴾", ref: "سورة الشرح — الآية 6",
    line: "ضغط الشغل لا يعطل الفريق المنظم، بل يظهر قوته." },
  { code: "DEC", label: "ديسمبر 2026", slug: "december", emoji: "✨",
    verse: "﴿وَمَنْ يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ﴾", ref: "سورة الطلاق — الآية 3",
    line: "اختم العام بما يثبت أن النجاح نتيجة عمل مستمر لا لحظة عابرة." },
] as const;

export const MONTH_BY_SLUG = Object.fromEntries(MONTHS.map((m) => [m.slug, m])) as Record<
  string,
  (typeof MONTHS)[number]
>;

export const WORKFLOW_STEPS = [
  "السيلز يسجل الطلب",
  "مراجعة البيانات",
  "تحديد الأولوية والموعد",
  "جاهز للتصميم",
  "التنفيذ",
  "التعديلات",
  "الاعتماد النهائي",
  "التسليم",
];

export const SALES_CHECKLIST_ITEMS = [
  { key: "customer_data", label: "بيانات العميل مكتملة" },
  { key: "size_qty_material", label: "المقاس والكمية والخامة واضحة" },
  { key: "design_brief", label: "المطلوب من التصميم واضح" },
  { key: "deadline_priority", label: "الموعد والأولوية محددان" },
  { key: "reference_files", label: "الملفات المرجعية مرفوعة" },
] as const;

export const DESIGN_CHECKLIST_ITEMS = [
  { key: "brief_received", label: "استلام البريف ومراجعته" },
  { key: "execution_started", label: "بدء التنفيذ" },
  { key: "revisions_logged", label: "تسجيل التعديلات" },
  { key: "final_approved", label: "اعتماد النسخة النهائية" },
  { key: "final_uploaded", label: "رفع الملف النهائي وتسجيل تاريخ التسليم" },
] as const;

export const STATUS_COLOR: Record<OverallStatus, string> = {
  "جديد": "bg-slate-100 text-slate-700 border-slate-200",
  "عند السيلز": "bg-blue-50 text-blue-700 border-blue-200",
  "جاهز للتصميم": "bg-amber-50 text-amber-800 border-amber-200",
  "قيد التصميم": "bg-orange-50 text-orange-800 border-orange-200",
  "تعديلات": "bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200",
  "بانتظار الاعتماد": "bg-purple-50 text-purple-800 border-purple-200",
  "مكتمل": "bg-emerald-50 text-emerald-800 border-emerald-200",
  "متوقف": "bg-red-50 text-red-700 border-red-200",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  "عاجل": "bg-red-100 text-red-700 border-red-300",
  "عالية": "bg-orange-100 text-orange-700 border-orange-300",
  "متوسطة": "bg-yellow-100 text-yellow-800 border-yellow-300",
  "عادية": "bg-slate-100 text-slate-700 border-slate-300",
};
