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
  delivery_due_time: z.string().nullable().optional(),
  stop_reason: z.string().nullable().optional(),
  revision_note: z.string().nullable().optional(),
  reopen_note: z.string().nullable().optional(),
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
  .inputValidator((d: {
    task_id: string; body: string;
    parent_id?: string | null; is_internal?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    if (!data.body.trim()) throw new Error("empty");
    const { data: row, error } = await context.supabase
      .from("task_comments")
      .insert({
        task_id: data.task_id,
        author_id: context.userId,
        body: data.body.trim(),
        parent_id: data.parent_id ?? null,
        is_internal: data.is_internal ?? false,
      } as any)
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const editComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; body: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("task_comments")
      .update({ body: data.body.trim(), edited_at: new Date().toISOString() } as any)
      .eq("id", data.id).eq("author_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("task_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const pinComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; pinned: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("task_comments")
      .update({ is_pinned: data.pinned } as any).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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

// Quick update — server-validates transitions and returns the diff.
export const quickUpdateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    patch: Record<string, unknown>;
    note?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const { data: cur, error: getErr } = await context.supabase
      .from("tasks").select("*").eq("id", data.id).maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!cur) throw new Error("التاسك غير موجود");

    const next: any = { ...cur, ...data.patch };

    // Transition validations
    const missing: string[] = [];
    if (data.patch.overall_status === "جاهز للتصميم") {
      if (!next.customer_name?.trim()) missing.push("اسم العميل");
      if (!next.products || (next.products as string[]).length === 0) missing.push("المنتج / الخدمة");
      if (!next.order_details?.trim()) missing.push("تفاصيل الطلب");
      if (!next.design_brief?.trim()) missing.push("المطلوب من التصميم");
      if (!next.delivery_due_date) missing.push("موعد التسليم");
    }
    if (data.patch.overall_status === "قيد التصميم" && !next.design_start_date) {
      (data.patch as any).design_start_date = new Date().toISOString().slice(0, 10);
    }
    if (data.patch.overall_status === "بانتظار الاعتماد") {
      if (!next.files_url && !next.final_version_url) missing.push("رابط ملف تصميم واحد على الأقل");
    }
    if (data.patch.overall_status === "مكتمل") {
      if (next.design_status !== "معتمد") missing.push("حالة التصميم يجب أن تكون معتمد");
      if (!next.final_version_url) missing.push("رابط النسخة النهائية");
      if (!next.actual_delivery_date) missing.push("تاريخ التسليم الفعلي");
      if (!next.delivered) missing.push("تفعيل مربع تم التسليم");
    }
    if (missing.length) throw new Error("لا يمكن التحديث. مطلوب: " + missing.join(" • "));

    const { data: row, error } = await context.supabase
      .from("tasks").update(data.patch as any).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);

    if (data.note?.trim()) {
      await context.supabase.from("task_activity").insert({
        task_id: data.id, actor_id: context.userId, action: "note",
        details: { note: data.note.trim() },
      } as any);
    }
    return row;
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
      .from("profiles")
      .select("id, full_name, email, is_active, avatar_url, phone, department, job_title, branch, last_sign_in_at, archived_at, created_at")
      .order("full_name");
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    });
    return (data ?? []).map((p) => ({ ...(p as any), roles: roleMap.get((p as any).id) ?? [] }));
  });

export const myRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
    return (data ?? []).map((r) => r.role as string);
  });

// ============ Phase D: Files ============
export const listTaskFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { task_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("task_attachments").select("*")
      .eq("task_id", data.task_id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const recordTaskFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    task_id: string; file_name: string; file_url: string;
    kind?: string; file_size?: number | null; mime_type?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("task_attachments").insert({
        task_id: data.task_id,
        uploader_id: context.userId,
        file_name: data.file_name,
        file_url: data.file_url,
        kind: data.kind ?? "reference",
        file_size: data.file_size ?? null,
        mime_type: data.mime_type ?? null,
      } as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const signTaskFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { path: string; expires?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.storage
      .from("task-files").createSignedUrl(data.path, data.expires ?? 300);
    if (error) throw new Error(error.message);
    return r;
  });

export const deleteTaskFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { attachment_id: string; path: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase.storage.from("task-files").remove([data.path]);
    const { error } = await context.supabase.from("task_attachments").delete().eq("id", data.attachment_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ Phase F: Notification prefs + bulk mark ============
export const getNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notification_preferences").select("*").eq("user_id", context.userId).maybeSingle();
    return data ?? {
      user_id: context.userId,
      sounds_enabled: true, volume_normal: 60, volume_urgent: 90,
      quiet_hours_start: null, quiet_hours_end: null, event_toggles: {},
    };
  });

export const saveNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    sounds_enabled?: boolean; volume_normal?: number; volume_urgent?: number;
    quiet_hours_start?: number | null; quiet_hours_end?: number | null;
    event_toggles?: Record<string, boolean>;
  }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notification_preferences")
      .upsert({ user_id: context.userId, ...data } as any, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("notifications").update({ is_read: true })
      .eq("user_id", context.userId).eq("is_read", false);
    return { ok: true };
  });
