import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActivity, listProfiles } from "@/lib/tasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
  head: () => ({ meta: [{ title: "سجل النشاط — Elsewedy Task Flow" }] }),
});

function ActivityPage() {
  const actFn = useServerFn(listActivity);
  const profFn = useServerFn(listProfiles);
  const { data: rows = [] } = useQuery({ queryKey: ["activity-all"], queryFn: () => actFn({ data: { limit: 200 } }) });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles-lite"], queryFn: () => profFn() });
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name || p.email]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">سجل النشاط</h1>
        <p className="text-sm text-muted-foreground">آخر التغييرات على المهام</p>
      </div>
      <Card className="card-soft">
        <CardHeader><CardTitle className="text-base">{rows.length} حدث</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex gap-3 border-r-2 border-primary pr-3 py-2">
                <div className="text-sm flex-1">
                  <div><span className="font-medium">{nameById.get(r.actor_id ?? "") ?? "—"}</span> — <span className="text-primary">{r.action}</span></div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans">{JSON.stringify(r.details, null, 0)}</pre>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.created_at)}</div>
              </div>
            ))}
            {rows.length === 0 && <div className="text-muted-foreground text-sm text-center py-8">لا يوجد نشاط بعد</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
