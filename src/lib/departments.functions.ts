// Server functions for departments, memberships, task types, and assignments.
// All writes go through RLS: departments require manage_departments,
// memberships require manage_department_members, task_types require manage_task_types.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function auditStructure(
  context: any,
  action: string,
  entity_type: string,
  entity_id: string | null,
  before: any,
  after: any,
  details: Record<string, any> = {},
) {
  await context.supabase.from("structure_audit_log").insert({
    actor_id: context.userId,
    action, entity_type, entity_id, before, after, details,
  } as any);
}

// ---------- CAPABILITY CHECKS ----------
export const getDepartmentCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [m, mm, mt] = await Promise.all([
      context.supabase.rpc("can_manage_departments",       { _user_id: context.userId }),
      context.supabase.rpc("can_manage_department_members",{ _user_id: context.userId }),
      context.supabase.rpc("can_manage_task_types",        { _user_id: context.userId }),
    ]);
    return {
      manage_departments:        m.data === true,
      manage_department_members: mm.data === true,
      manage_task_types:         mt.data === true,
    };
  });

// ---------- DEPARTMENTS ----------
export const listDepartments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: depts, error } = await context.supabase
      .from("departments").select("*")
      .order("sort_order", { ascending: true }).order("name_ar", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (depts ?? []).map((d: any) => d.id);
    if (ids.length === 0) return [];
    const { data: memberships } = await context.supabase
      .from("department_memberships").select("department_id, user_id, role")
      .in("department_id", ids).eq("active", true);
    const memberCount = new Map<string, number>();
    const managers = new Map<string, string[]>();
    (memberships ?? []).forEach((m: any) => {
      memberCount.set(m.department_id, (memberCount.get(m.department_id) ?? 0) + 1);
      if (m.role === "department_manager") {
        const arr = managers.get(m.department_id) ?? [];
        arr.push(m.user_id);
        managers.set(m.department_id, arr);
      }
    });
    const { data: taskCounts } = await context.supabase
      .from("tasks").select("department_id").in("department_id", ids).is("deleted_at", null);
    const taskCount = new Map<string, number>();
    (taskCounts ?? []).forEach((t: any) => {
      if (t.department_id) taskCount.set(t.department_id, (taskCount.get(t.department_id) ?? 0) + 1);
    });
    return (depts ?? []).map((d: any) => ({
      ...d,
      members_count: memberCount.get(d.id) ?? 0,
      managers_ids:  managers.get(d.id) ?? [],
      tasks_count:   taskCount.get(d.id) ?? 0,
    }));
  });

const deptInputSchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/, {
    message: "المفتاح يجب أن يحتوي فقط على حروف إنجليزية صغيرة وأرقام و _",
  }),
  name_ar: z.string().trim().min(1).max(80),
  name_en: z.string().trim().max(80).default(""),
  color: z.string().trim().max(20).default("#E30613"),
  icon: z.string().trim().max(40).default("Building2"),
  description: z.string().trim().max(500).nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).default(100),
});

export const createDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deptInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("departments").insert({ ...data, created_by: context.userId } as any)
      .select().single();
    if (error) throw new Error(error.message);
    await auditStructure(context, "create", "department", row.id, null, row);
    return row;
  });

export const updateDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const forbid = ["id","created_at","created_by"];
    for (const k of forbid) if (k in (data.patch as any)) delete (data.patch as any)[k];
    const { data: before } = await context.supabase
      .from("departments").select("*").eq("id", data.id).maybeSingle();
    const { data: after, error } = await context.supabase
      .from("departments").update(data.patch as any).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await auditStructure(context, "update", "department", data.id, before, after);
    return after;
  });

export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: before } = await context.supabase
      .from("departments").select("*").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("departments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditStructure(context, "delete", "department", data.id, before, null);
    return { ok: true };
  });

export const reorderDepartments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ordered_ids: string[] }) => d)
  .handler(async ({ data, context }) => {
    for (let i = 0; i < data.ordered_ids.length; i++) {
      await context.supabase
        .from("departments")
        .update({ sort_order: (i + 1) * 10 } as any)
        .eq("id", data.ordered_ids[i]);
    }
    await auditStructure(context, "reorder", "department", null, null,
      { count: data.ordered_ids.length }, { order: data.ordered_ids });
    return { ok: true };
  });

// ---------- MEMBERSHIPS ----------
export const listDepartmentMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { department_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("department_memberships")
      .select("*, profiles:user_id(id, full_name, email, job_title, avatar_url, is_active)")
      .eq("department_id", data.department_id)
      .order("role", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const memberInputSchema = z.object({
  department_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["department_manager","department_supervisor","team_leader","employee","viewer"]),
  is_primary: z.boolean().default(false),
});

export const addDepartmentMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.user_id === context.userId) {
      throw new Error("لا يمكنك إضافة نفسك أو تعديل عضويتك الخاصة");
    }
    const { data: row, error } = await context.supabase
      .from("department_memberships")
      .upsert({ ...data, active: true, created_by: context.userId } as any,
        { onConflict: "department_id,user_id" })
      .select().single();
    if (error) throw new Error(error.message);
    await auditStructure(context, "add_member", "department_membership", row.id, null, row);
    return row;
  });

export const updateDepartmentMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: { role?: string; is_primary?: boolean; active?: boolean } }) => d)
  .handler(async ({ data, context }) => {
    const { data: before } = await context.supabase
      .from("department_memberships").select("*").eq("id", data.id).maybeSingle();
    if (before?.user_id === context.userId) throw new Error("لا يمكنك تعديل عضويتك الخاصة");
    const { data: after, error } = await context.supabase
      .from("department_memberships").update(data.patch as any).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await auditStructure(context, "update_member", "department_membership", data.id, before, after);
    return after;
  });

export const removeDepartmentMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: before } = await context.supabase
      .from("department_memberships").select("*").eq("id", data.id).maybeSingle();
    if (before?.user_id === context.userId) throw new Error("لا يمكنك حذف عضويتك الخاصة");
    const { error } = await context.supabase
      .from("department_memberships").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditStructure(context, "remove_member", "department_membership", data.id, before, null);
    return { ok: true };
  });

// Users I can add to a department (all active profiles).
export const listAssignableUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles").select("id, full_name, email, job_title, department, is_active")
      .eq("is_active", true).is("archived_at", null).order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- TASK TYPES ----------
export const listTaskTypes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("task_types").select("*, departments:department_id(id, name_ar, key, color)")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const taskTypeSchema = z.object({
  key: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  name_ar: z.string().trim().min(1).max(80),
  name_en: z.string().trim().max(80).default(""),
  color: z.string().trim().max(20).default("#FF5A2C"),
  icon: z.string().trim().max(40).default("ClipboardList"),
  description: z.string().trim().max(500).nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  code_prefix: z.string().trim().max(10).nullable().optional(),
  default_priority: z.enum(["عاجل","عالية","متوسطة","عادية"]).default("عادية"),
  default_sla_hours: z.number().int().min(0).max(9999).nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).max(9999).default(100),
});

export const createTaskType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => taskTypeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("task_types").insert({ ...data, created_by: context.userId } as any)
      .select().single();
    if (error) throw new Error(error.message);
    await auditStructure(context, "create", "task_type", row.id, null, row);
    return row;
  });

export const updateTaskType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    const forbid = ["id","created_at","created_by"];
    for (const k of forbid) if (k in (data.patch as any)) delete (data.patch as any)[k];
    const { data: before } = await context.supabase
      .from("task_types").select("*").eq("id", data.id).maybeSingle();
    const { data: after, error } = await context.supabase
      .from("task_types").update(data.patch as any).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await auditStructure(context, "update", "task_type", data.id, before, after);
    return after;
  });

export const deleteTaskType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("tasks").select("id", { count: "exact", head: true }).eq("task_type_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error(`لا يمكن حذف نوع المهمة لوجود ${count} تاسك يستخدمه. يمكنك أرشفته بدلًا من ذلك.`);
    }
    const { data: before } = await context.supabase
      .from("task_types").select("*").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("task_types").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await auditStructure(context, "delete", "task_type", data.id, before, null);
    return { ok: true };
  });

// ---------- ASSIGNMENTS (read-only listing helper) ----------
export const listTaskAssignments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { task_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("task_assignments")
      .select("*, profiles:user_id(id, full_name, email, avatar_url), departments:department_id(id, name_ar, color)")
      .eq("task_id", data.task_id).eq("active", true)
      .order("assigned_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
