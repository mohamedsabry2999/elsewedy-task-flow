import { createFileRoute } from "@tanstack/react-router";

// Simple in-memory rate limiter (per-IP, 6 requests/min).
// Note: Worker instances are ephemeral; this is best-effort DoS protection,
// real enforcement is the Bearer secret below.
const rlBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(ip: string, limit = 6, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = rlBuckets.get(ip);
  if (!b || b.resetAt < now) {
    rlBuckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const REMINDER_STAGES = [
  { key: "due_24h", hours: 24, title: "تذكير: التسليم بعد 24 ساعة", severity: "normal" as const },
  { key: "due_4h",  hours: 4,  title: "تذكير: التسليم بعد 4 ساعات", severity: "normal" as const },
  { key: "due_1h",  hours: 1,  title: "تذكير: التسليم بعد ساعة",    severity: "urgent" as const },
];

export const Route = createFileRoute("/api/public/hooks/overdue-scan")({
  server: {
    handlers: {
      GET: async () => new Response("Method Not Allowed", { status: 405 }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token || token.length < 16) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const ip =
          request.headers.get("cf-connecting-ip") ||
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        if (!rateLimit(ip)) {
          return new Response(JSON.stringify({ error: "rate_limited" }), {
            status: 429, headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Verify token against Vault via RPC (constant-time in SQL)
          const { data: verified, error: vErr } = await supabaseAdmin
            .rpc("verify_overdue_scan_secret", { _token: token });
          if (vErr || verified !== true) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401, headers: { "Content-Type": "application/json" },
            });
          }
          const nowMs = Date.now();
          const nowIso = new Date(nowMs).toISOString();

          // Fetch active tasks with a due_at set
          const { data: tasks, error: tErr } = await supabaseAdmin
            .from("tasks")
            .select("id, task_code, task_name, sales_owner_id, designer_id, overall_status, due_at, delivery_due_date, is_archived, deleted_at")
            .eq("is_archived", false)
            .is("deleted_at", null)
            .not("overall_status", "in", '("مكتمل","متوقف")')
            .not("due_at", "is", null);

          if (tErr) {
            console.error("[overdue-scan] fetch tasks failed");
            return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
          }

          // Managers to also notify
          const { data: mgrs } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .in("role", ["design_manager", "sales_manager"]);
          const managerIds = (mgrs || []).map((r: any) => r.user_id);

          const dedupeWindowMs = 4 * 60 * 60 * 1000;
          const dedupeStart = new Date(nowMs - dedupeWindowMs).toISOString();

          let createdReminders = 0;
          let createdOverdue = 0;

          for (const t of tasks || []) {
            const due = t.due_at ? new Date(t.due_at).getTime() : null;
            if (!due) continue;

            const recipients = new Set<string>();
            if (t.sales_owner_id) recipients.add(t.sales_owner_id);
            if (t.designer_id) recipients.add(t.designer_id);
            for (const id of managerIds) recipients.add(id);
            if (recipients.size === 0) continue;

            // Overdue
            if (due < nowMs) {
              for (const uid of recipients) {
                const { data: recent } = await supabaseAdmin
                  .from("overdue_events")
                  .select("id")
                  .eq("task_id", t.id).eq("user_id", uid).eq("stage", "overdue")
                  .gte("sent_at", dedupeStart).limit(1);
                if (recent && recent.length > 0) continue;

                const { error: nErr } = await supabaseAdmin.from("notifications").insert({
                  user_id: uid, task_id: t.id,
                  title: "تاسك متأخر عن موعد التسليم",
                  body: `${t.task_code ?? ""} — ${t.task_name}`,
                  kind: "overdue", severity: "urgent",
                  data: { task_code: t.task_code, task_name: t.task_name, stage: "overdue" },
                });
                if (nErr) continue;
                await supabaseAdmin.from("overdue_events").insert({
                  task_id: t.id, user_id: uid, stage: "overdue",
                });
                createdOverdue++;
              }
              continue;
            }

            // Upcoming reminders
            const hoursLeft = (due - nowMs) / 3_600_000;
            for (const stage of REMINDER_STAGES) {
              // fire if due within stage.hours (and beyond the next tighter stage window)
              if (hoursLeft > stage.hours) continue;
              for (const uid of recipients) {
                const { data: recent } = await supabaseAdmin
                  .from("overdue_events")
                  .select("id")
                  .eq("task_id", t.id).eq("user_id", uid).eq("stage", stage.key)
                  .limit(1);
                if (recent && recent.length > 0) continue;

                const { error: nErr } = await supabaseAdmin.from("notifications").insert({
                  user_id: uid, task_id: t.id,
                  title: stage.title,
                  body: `${t.task_code ?? ""} — ${t.task_name}`,
                  kind: "reminder", severity: stage.severity,
                  data: { task_code: t.task_code, task_name: t.task_name, stage: stage.key },
                });
                if (nErr) continue;
                await supabaseAdmin.from("overdue_events").insert({
                  task_id: t.id, user_id: uid, stage: stage.key,
                });
                createdReminders++;
              }
              break; // one stage per task per scan
            }
          }

          console.log(`[overdue-scan] scanned=${tasks?.length ?? 0} overdue=${createdOverdue} reminders=${createdReminders}`);
          return new Response(JSON.stringify({ ok: true }), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("[overdue-scan] error", (e as Error)?.message);
          return new Response(JSON.stringify({ error: "internal" }), { status: 500 });
        }
      },
    },
  },
});
