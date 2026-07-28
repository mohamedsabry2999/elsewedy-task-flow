import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// --- Schemas ---
const taskInputSchema = z.object({
  task_name: z.string().trim().min(1).max(200),
  month_code: z.enum(["AUG", "SEP", "OCT", "NOV", "DEC"]),
  customer_name: z.string().trim().max(200).default(""),
  sales_owner_id: z.string().uuid().nullable().optional(),
  customer_type: z.enum(["عميل حالي", "عميل جديد", "عميل محتمل"]).nullable().optional(),
  products: z.array(z.string()).default([]),
  order_details: z.string().max(2000).nullable().optional(),
  size_qty_material: z.string().max(500).nullable().optional(),
  design_brief: z.string().max(2000).nullable().optional(),
  priority: z.enum(["عاجل", "عالية", "متوسطة", "عادية"]).default("عادية"),
  request_date: z.string().nullable().optional(),
  designer_id: z.string().uuid().nullable().optional(),
  delivery_due_date: z.string().nullable().optional(),
  overall_status: z.string().default("جديد"),
});

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { month?: string; includeArchived?: boolean } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("tasks")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!data.includeArchived) q = q.eq("is_archived", false);
    if (data.month) q = q.eq("month_code", data.month);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tasks").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      ...data,
      sales_owner_id: data.sales_owner_id ?? context.userId,
      created_by: context.userId,
    };
    const { data: row, error } = await context.supabase
      .from("tasks").insert(payload as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("tasks").update(data.patch as any).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const archiveTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; archived: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks").update({ is_archived: data.archived }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const softDeleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { task_id: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    if (!data.body.trim()) throw new Error("empty");
    const { data: row, error } = await context.supabase
      .from("task_comments")
      .insert({ task_id: data.task_id, author_id: context.userId, body: data.body.trim() })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { task_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("task_comments").select("*").eq("task_id", data.task_id).order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { task_id?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("task_activity").select("*")
      .order("created_at", { ascending: false }).limit(data.limit ?? 100);
    if (data.task_id) q = q.eq("task_id", data.task_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications").select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase.from("notifications").update({ is_read: true }).eq("id", data.id);
    return { ok: true };
  });

export const dashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("tasks").select("id, overall_status, month_code, sales_owner_id, designer_id, delivery_due_date, delivered")
      .is("deleted_at", null).eq("is_archived", false);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const byStatus: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const byOwner: Record<string, number> = {};
    let overdue = 0, completed = 0;
    for (const r of list) {
      byStatus[r.overall_status] = (byStatus[r.overall_status] ?? 0) + 1;
      byMonth[r.month_code] = (byMonth[r.month_code] ?? 0) + 1;
      const key = r.sales_owner_id ?? "بدون";
      byOwner[key] = (byOwner[key] ?? 0) + 1;
      if (r.overall_status === "مكتمل") completed++;
      if (r.delivery_due_date && !r.delivered && new Date(r.delivery_due_date) < today
          && r.overall_status !== "مكتمل") overdue++;
    }
    const total = list.length;
    return {
      total,
      at_sales: (byStatus["جديد"] ?? 0) + (byStatus["عند السيلز"] ?? 0),
      ready_for_design: byStatus["جاهز للتصميم"] ?? 0,
      in_design: byStatus["قيد التصميم"] ?? 0,
      awaiting_approval: byStatus["بانتظار الاعتماد"] ?? 0,
      completed,
      overdue,
      completion_pct: total ? Math.round((completed / total) * 100) : 0,
      byStatus, byMonth, byOwner,
    };
  });

export const listProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles").select("id, full_name, email, is_active").order("full_name");
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    });
    return (data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
  });

export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return (data ?? []).map((r) => r.role as string);
  });
