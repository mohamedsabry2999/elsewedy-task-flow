// Server functions for managing years, months, and structure audit log.
// All queries flow through the authenticated Supabase client so RLS enforces
// `can_manage_structure(auth.uid())` for every write.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MONTH_NAMES_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
const MONTH_CODES = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
const MONTH_SLUGS = [
  "january","february","march","april","may","june",
  "july","august","september","october","november","december",
];

async function assertCanManage(context: any) {
  const { data, error } = await context.supabase.rpc("can_manage_structure", {
    _user_id: context.userId,
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("ليست لديك صلاحية إدارة هيكل النظام");
}

async function logAudit(
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
    action, entity_type, entity_id,
    before, after, details,
  } as any);
}

// -------- YEARS --------
export const listYears = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("years").select("*").order("year", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((y: any) => y.id);
    if (ids.length === 0) return [];
    const { data: months } = await context.supabase
      .from("months").select("id, year_id").in("year_id", ids);
    const monthCountByYear = new Map<string, number>();
    (months ?? []).forEach((m: any) => {
      monthCountByYear.set(m.year_id, (monthCountByYear.get(m.year_id) ?? 0) + 1);
    });
    // Task counts per year via month_code (kept for backward compat).
    const { data: allMonths } = await context.supabase
      .from("months").select("id, year_id, month_code").in("year_id", ids);
    const codesByYear = new Map<string, string[]>();
    const idsByYear = new Map<string, string[]>();
    (allMonths ?? []).forEach((m: any) => {
      if (m.month_code) {
        const arr = codesByYear.get(m.year_id) ?? [];
        arr.push(m.month_code); codesByYear.set(m.year_id, arr);
      }
      const idArr = idsByYear.get(m.year_id) ?? [];
      idArr.push(m.id); idsByYear.set(m.year_id, idArr);
    });
    const taskCountByYear = new Map<string, number>();
    for (const yid of ids) {
      const codes = codesByYear.get(yid) ?? [];
      const mids = idsByYear.get(yid) ?? [];
      let count = 0;
      if (mids.length > 0) {
        const { count: c1 } = await context.supabase
          .from("tasks").select("id", { count: "exact", head: true })
          .in("month_id", mids).is("deleted_at", null);
        count += c1 ?? 0;
      }
      if (codes.length > 0) {
        const { count: c2 } = await context.supabase
          .from("tasks").select("id", { count: "exact", head: true })
          .in("month_code", codes).is("month_id", null).is("deleted_at", null);
        count += c2 ?? 0;
      }
      taskCountByYear.set(yid, count);
    }
    return (data ?? []).map((y: any) => ({
      ...y,
      months_count: monthCountByYear.get(y.id) ?? 0,
      tasks_count: taskCountByYear.get(y.id) ?? 0,
    }));
  });

const createYearSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  seed_all_months: z.boolean().default(false),
  seed_month_nums: z.array(z.number().int().min(1).max(12)).default([]),
  copy_from_year_id: z.string().uuid().nullable().optional(),
});

export const createYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createYearSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: existing } = await context.supabase
      .from("years").select("id").eq("year", data.year).maybeSingle();
    if (existing) throw new Error("السنة موجودة بالفعل");

    const { data: y, error } = await context.supabase
      .from("years").insert({
        year: data.year, is_active: true, is_default: false, is_archived: false,
        created_by: context.userId,
      } as any).select().single();
    if (error) throw new Error(error.message);

    let seedNums: number[] = [];
    if (data.copy_from_year_id) {
      const { data: src } = await context.supabase
        .from("months").select("month_num, name_ar, month_code, slug, emoji, verse, verse_ref, line")
        .eq("year_id", data.copy_from_year_id);
      if (src && src.length > 0) {
        const rows = src.map((m: any) => ({
          year_id: y.id,
          month_num: m.month_num, name_ar: m.name_ar,
          month_code: m.month_code, slug: m.slug,
          emoji: m.emoji, verse: m.verse, verse_ref: m.verse_ref, line: m.line,
          created_by: context.userId,
        }));
        await context.supabase.from("months").insert(rows as any);
        seedNums = rows.map((r: any) => r.month_num);
      }
    } else if (data.seed_all_months) {
      seedNums = Array.from({ length: 12 }, (_, i) => i + 1);
    } else if (data.seed_month_nums.length > 0) {
      seedNums = [...new Set(data.seed_month_nums)];
    }

    if (!data.copy_from_year_id && seedNums.length > 0) {
      const rows = seedNums.map((n) => ({
        year_id: y.id,
        month_num: n,
        name_ar: MONTH_NAMES_AR[n - 1],
        month_code: MONTH_CODES[n - 1],
        slug: MONTH_SLUGS[n - 1],
        created_by: context.userId,
      }));
      await context.supabase.from("months").insert(rows as any);
    }

    await logAudit(context, "create", "year", y.id, null, y, {
      seed_month_nums: seedNums, copied_from: data.copy_from_year_id ?? null,
    });
    return y;
  });

export const updateYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    patch: { is_active?: boolean; is_default?: boolean; is_archived?: boolean; sort_desc?: boolean };
  }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: before } = await context.supabase.from("years").select("*").eq("id", data.id).maybeSingle();
    const { data: after, error } = await context.supabase
      .from("years").update(data.patch as any).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logAudit(context, "update", "year", data.id, before, after);
    return after;
  });

export const deleteYear = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: before } = await context.supabase.from("years").select("*").eq("id", data.id).maybeSingle();
    // Delete children months first (they'll block via trigger if they have tasks)
    const { error: mErr } = await context.supabase.from("months").delete().eq("year_id", data.id);
    if (mErr) throw new Error(mErr.message);
    const { error } = await context.supabase.from("years").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "delete", "year", data.id, before, null);
    return { ok: true };
  });

// -------- MONTHS --------
export const listMonths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year_id?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("months").select("*").order("month_num", { ascending: true });
    if (data.year_id) q = q.eq("year_id", data.year_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// Public helper: months for navigation (all users). Returns dynamic
// months from active, non-archived years so sidebar reflects DB config.
export const listNavMonths = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: years } = await context.supabase
      .from("years").select("id, year, is_default, is_active, is_archived")
      .eq("is_active", true).eq("is_archived", false)
      .order("year", { ascending: false });
    if (!years || years.length === 0) return { years: [], months: [] };
    const yearIds = years.map((y: any) => y.id);
    const { data: months } = await context.supabase
      .from("months").select("*").in("year_id", yearIds)
      .eq("is_archived", false).eq("is_hidden", false)
      .order("month_num", { ascending: true });
    return { years, months: months ?? [] };
  });

const monthInputSchema = z.object({
  year_id: z.string().uuid(),
  month_num: z.number().int().min(1).max(12),
  name_ar: z.string().trim().max(50).optional(),
  month_code: z.string().trim().max(10).optional(),
  slug: z.string().trim().max(40).optional(),
  emoji: z.string().trim().max(10).nullable().optional(),
  verse: z.string().trim().max(500).nullable().optional(),
  verse_ref: z.string().trim().max(200).nullable().optional(),
  line: z.string().trim().max(500).nullable().optional(),
});

export const createMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => monthInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: dup } = await context.supabase
      .from("months").select("id")
      .eq("year_id", data.year_id).eq("month_num", data.month_num).maybeSingle();
    if (dup) throw new Error("هذا الشهر موجود بالفعل في هذه السنة");

    const row = {
      year_id: data.year_id,
      month_num: data.month_num,
      name_ar: data.name_ar ?? MONTH_NAMES_AR[data.month_num - 1],
      month_code: data.month_code ?? MONTH_CODES[data.month_num - 1],
      slug: data.slug ?? MONTH_SLUGS[data.month_num - 1],
      emoji: data.emoji ?? null, verse: data.verse ?? null,
      verse_ref: data.verse_ref ?? null, line: data.line ?? null,
      created_by: context.userId,
    };
    const { data: m, error } = await context.supabase
      .from("months").insert(row as any).select().single();
    if (error) throw new Error(error.message);
    await logAudit(context, "create", "month", m.id, null, m);
    return m;
  });

export const bulkCreateMonths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { year_id: string; month_nums: number[] }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const uniq = [...new Set(data.month_nums.filter((n) => n >= 1 && n <= 12))];
    if (uniq.length === 0) return { inserted: 0 };
    const { data: existing } = await context.supabase
      .from("months").select("month_num").eq("year_id", data.year_id);
    const existingNums = new Set((existing ?? []).map((m: any) => m.month_num));
    const toInsert = uniq.filter((n) => !existingNums.has(n)).map((n) => ({
      year_id: data.year_id,
      month_num: n,
      name_ar: MONTH_NAMES_AR[n - 1],
      month_code: MONTH_CODES[n - 1],
      slug: MONTH_SLUGS[n - 1],
      created_by: context.userId,
    }));
    if (toInsert.length === 0) return { inserted: 0 };
    const { data: inserted, error } = await context.supabase
      .from("months").insert(toInsert as any).select();
    if (error) throw new Error(error.message);
    await logAudit(context, "bulk_seed", "month", null, null,
      { count: inserted?.length ?? 0 }, { year_id: data.year_id, month_nums: toInsert.map((r) => r.month_num) });
    return { inserted: inserted?.length ?? 0 };
  });

export const updateMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    // Reject dangerous edits to schema-critical fields.
    const forbid = ["id", "year_id", "created_at", "created_by"];
    for (const k of forbid) if (k in data.patch) delete (data.patch as any)[k];
    const { data: before } = await context.supabase.from("months").select("*").eq("id", data.id).maybeSingle();
    const { data: after, error } = await context.supabase
      .from("months").update(data.patch as any).eq("id", data.id).select().single();
    if (error) throw new Error(error.message);
    await logAudit(context, "update", "month", data.id, before, after);
    return after;
  });

export const deleteMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertCanManage(context);
    const { data: before } = await context.supabase.from("months").select("*").eq("id", data.id).maybeSingle();
    const { error } = await context.supabase.from("months").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(context, "delete", "month", data.id, before, null);
    return { ok: true };
  });

// -------- AUDIT LOG --------
export const listStructureAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("structure_audit_log").select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -------- PERMISSION CHECK (for UI) --------
export const canManageStructure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("can_manage_structure", {
      _user_id: context.userId,
    });
    if (error) return false;
    return data === true;
  });
