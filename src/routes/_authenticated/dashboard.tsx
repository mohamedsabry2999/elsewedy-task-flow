import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { dashboardStats, listProfiles } from "@/lib/tasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { MONTHS, OVERALL_STATUS } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "لوحة القيادة — Elsewedy Task Flow" }] }),
});

const COLORS = ["#E30613", "#FF5A2C", "#4F46E5", "#059669", "#7C3AED", "#0891B2", "#DC2626", "#64748B"];

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Card className="card-soft">
      <CardContent className="p-5">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const statsFn = useServerFn(dashboardStats);
  const profilesFn = useServerFn(listProfiles);
  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles-lite"], queryFn: () => profilesFn() });

  if (!stats) return <div className="p-8 text-muted-foreground">جارٍ التحميل…</div>;

  const nameById = new Map(profiles.map((p) => [p.id, p.full_name || p.email]));
  const monthData = MONTHS.map((m) => ({ name: m.label, value: stats.byMonth[m.code] ?? 0 }));
  const statusData = OVERALL_STATUS.map((s) => ({ name: s, value: stats.byStatus[s] ?? 0 })).filter((d) => d.value > 0);
  const ownerData = Object.entries(stats.byOwner).map(([k, v]) => ({ name: nameById.get(k) ?? "بدون", value: v })).slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">لوحة القيادة</h1>
        <p className="text-sm text-muted-foreground">نظرة عامة على أداء الفريق ومهام السيلز والتصميم</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="إجمالي المهام" value={stats.total} />
        <Kpi label="عند السيلز" value={stats.at_sales} />
        <Kpi label="جاهز للتصميم" value={stats.ready_for_design} />
        <Kpi label="قيد التصميم" value={stats.in_design} />
        <Kpi label="بانتظار الاعتماد" value={stats.awaiting_approval} />
        <Kpi label="مكتملة" value={stats.completed} tone="text-emerald-600" />
        <Kpi label="متأخرة" value={stats.overdue} tone="text-primary" />
        <Kpi label="نسبة الإنجاز" value={`${stats.completion_pct}%`} tone="text-accent" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="card-soft">
          <CardHeader><CardTitle className="text-base">التوزيع حسب الشهر</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#E30613" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader><CardTitle className="text-base">التوزيع حسب الحالة</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="card-soft lg:col-span-2">
          <CardHeader><CardTitle className="text-base">المهام حسب مسؤول السيلز</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={ownerData} layout="vertical" margin={{ right: 24 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#FF5A2C" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
