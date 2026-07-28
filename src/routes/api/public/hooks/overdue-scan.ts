import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/overdue-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const apikey = request.headers.get("apikey") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!apikey || apikey !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const nowIso = new Date().toISOString();

        // Fetch overdue tasks: due before now, not completed/stopped/archived/soft-deleted
        const { data: tasks, error: tErr } = await supabaseAdmin
          .from("tasks")
          .select("id, task_code, task_name, sales_owner_id, designer_id, overall_status, delivery_due_date, due_at, is_archived, deleted_at")
          .eq("is_archived", false)
          .is("deleted_at", null)
          .not("overall_status", "in", '("مكتمل","متوقف")')
          .or(`due_at.lt.${nowIso},delivery_due_date.lt.${new Date().toISOString().slice(0,10)}`);

        if (tErr) {
          return new Response(JSON.stringify({ error: tErr.message }), { status: 500 });
        }

        // Collect design managers to also notify
        const { data: dms } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .in("role", ["design_manager", "sales_manager"]);
        const managerIds = (dms || []).map((r: any) => r.user_id);

        // Dedupe window: 4 hours
        const windowStart = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

        let created = 0;
        for (const t of tasks || []) {
          const recipients = new Set<string>();
          if (t.sales_owner_id) recipients.add(t.sales_owner_id);
          if (t.designer_id) recipients.add(t.designer_id);
          for (const id of managerIds) recipients.add(id);

          for (const uid of recipients) {
            // Check existing overdue event for this task+user in window
            const { data: recent } = await supabaseAdmin
              .from("overdue_events")
              .select("id")
              .eq("task_id", t.id)
              .eq("user_id", uid)
              .gte("sent_at", windowStart)
              .limit(1);
            if (recent && recent.length > 0) continue;

            const { error: nErr } = await supabaseAdmin.from("notifications").insert({
              user_id: uid,
              task_id: t.id,
              title: "تاسك متأخر عن موعد التسليم",
              body: `${t.task_code ?? ""} — ${t.task_name}`,
              kind: "overdue",
              severity: "urgent",
              data: { task_code: t.task_code, task_name: t.task_name },
            });
            if (nErr) continue;

            await supabaseAdmin.from("overdue_events").insert({
              task_id: t.id, user_id: uid, stage: "overdue",
            });
            created++;
          }
        }

        return new Response(JSON.stringify({
          success: true, scanned: tasks?.length ?? 0, created,
        }), { headers: { "Content-Type": "application/json" } });
      },
    },
  },
});
