import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.includes("super_admin") && !roles.includes("admin")) {
    throw new Error("Forbidden: admin required");
  }
  return roles;
}

// Create a new user with a role. Admins/super admins only.
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email(),
      password: z.string().min(8).max(200),
      full_name: z.string().trim().min(1).max(120),
      role: z.enum([
        "super_admin","admin","sales_manager","sales_executive","design_manager","designer","view_only",
      ]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    // trigger creates default view_only role; overwrite with the requested one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name }).eq("id", uid);
    return { id: uid };
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; role: string }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.user_id, role: data.role as any });
    return { ok: true };
  });

export const adminToggleActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; is_active: boolean }) => d)
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ is_active: data.is_active }).eq("id", data.user_id);
    return { ok: true };
  });

// Seed and remove demo data (super admin only).
export const loadDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
    const daysAhead = (n: number) => new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10);

    const samples = [
      { month_code: "AUG", task_name: "كتالوج شركة النور — نسخة أغسطس",
        customer_name: "شركة النور للاستثمار", customer_type: "عميل حالي",
        products: ["بروشور وكتالوج", "طباعة أوفست"],
        order_details: "كتالوج 24 صفحة بحجم A4 مع غلاف مقوى.",
        size_qty_material: "A4 — 500 نسخة — كوشيه 170 جم",
        design_brief: "تحديث الهوية البصرية للكتالوج مع إبراز خط المنتجات الجديد.",
        priority: "عالية", overall_status: "قيد التصميم", design_status: "قيد التنفيذ",
        request_date: daysAgo(10), delivery_due_date: daysAhead(2), delivered: false },
      { month_code: "AUG", task_name: "علبة تغليف عصير المزرعة",
        customer_name: "مزرعة الوادي", customer_type: "عميل جديد",
        products: ["علب وتغليف"],
        order_details: "علبة كرتون بأربعة تصاميم بنكهات مختلفة.",
        size_qty_material: "10×10×20 سم — 2000 نسخة — دوبلكس 350 جم",
        design_brief: "تصاميم مبهجة بألوان الفواكه الطبيعية.",
        priority: "عاجل", overall_status: "جاهز للتصميم", design_status: "لم يبدأ",
        request_date: daysAgo(2), delivery_due_date: daysAhead(7), delivered: false },
      { month_code: "SEP", task_name: "استيكرات معرض القاهرة",
        customer_name: "معرض القاهرة الدولي", customer_type: "عميل محتمل",
        products: ["ليبل واستيكر"],
        order_details: "استيكرات لتغليف الهدايا الترويجية.",
        size_qty_material: "8×8 سم — 5000 قطعة — كوشيه لاصق",
        design_brief: "شعار المعرض بألوان زاهية.",
        priority: "متوسطة", overall_status: "بانتظار الاعتماد", design_status: "بانتظار الاعتماد",
        request_date: daysAgo(5), delivery_due_date: daysAhead(10), delivered: false },
      { month_code: "SEP", task_name: "بروشور خدمات بنك مصر",
        customer_name: "بنك مصر", customer_type: "عميل حالي",
        products: ["بروشور وكتالوج", "طباعة ديجيتال"],
        order_details: "بروشور ثلاثي الطي للخدمات الرقمية.",
        size_qty_material: "A4 مطوي — 1000 نسخة — كوشيه 170 جم",
        design_brief: "بأسلوب رسمي يعكس هوية البنك.",
        priority: "عادية", overall_status: "مكتمل", design_status: "معتمد",
        request_date: daysAgo(30), delivery_due_date: daysAgo(5),
        actual_delivery_date: daysAgo(4), delivered: true },
      { month_code: "OCT", task_name: "شيتات دعائية لمعرض السيارات",
        customer_name: "شركة السويدي موتورز", customer_type: "عميل حالي",
        products: ["شيتات 50×70"],
        order_details: "بوسترات ترويجية للمعرض.",
        size_qty_material: "50×70 سم — 300 نسخة — كوشيه 200 جم",
        design_brief: "صور احترافية للسيارات الجديدة.",
        priority: "عالية", overall_status: "عند السيلز", design_status: "لم يبدأ",
        request_date: daysAgo(1), delivery_due_date: daysAhead(14), delivered: false },
      { month_code: "NOV", task_name: "طباعة ديجيتال — ملفات تعريفية",
        customer_name: "شركة ألفا للاستشارات", customer_type: "عميل جديد",
        products: ["طباعة ديجيتال"],
        order_details: "ملفات تعريفية للموظفين الجدد.",
        size_qty_material: "A4 — 200 نسخة — 120 جم",
        design_brief: "تصميم بسيط بألوان الشركة.",
        priority: "متوسطة", overall_status: "تعديلات", design_status: "تعديلات",
        request_date: daysAgo(7), delivery_due_date: daysAhead(20), delivered: false },
      { month_code: "DEC", task_name: "كتالوج نهاية العام للسويدي",
        customer_name: "الإدارة الداخلية", customer_type: "عميل حالي",
        products: ["بروشور وكتالوج", "طباعة أوفست"],
        order_details: "ملخص إنجازات العام.",
        size_qty_material: "A4 — 100 نسخة — كوشيه 250 جم",
        design_brief: "تصميم فاخر يبرز إنجازات 2026.",
        priority: "عاجل", overall_status: "جديد", design_status: "لم يبدأ",
        request_date: daysAgo(0), delivery_due_date: daysAhead(30), delivered: false },
    ];

    const rows = samples.map((s) => ({ ...s, is_demo: true, created_by: context.userId, sales_owner_id: context.userId }));
    const { error } = await supabaseAdmin.from("tasks").insert(rows as any);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const removeDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error, count } = await supabaseAdmin
      .from("tasks").delete({ count: "exact" }).eq("is_demo", true);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });

// Bootstrap: create the first super admin (only works when no super admin exists yet).
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email(),
      password: z.string().min(8).max(200),
      full_name: z.string().trim().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("role", "super_admin").limit(1);
    if (existing && existing.length > 0) throw new Error("Setup already completed");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const uid = created.user!.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "super_admin" });
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name }).eq("id", uid);
    return { ok: true };
  });

export const hasAnySuperAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin").limit(1);
  return { exists: (data ?? []).length > 0 };
});
