import { createFileRoute, notFound, useParams } from "@tanstack/react-router";
import { MONTH_BY_SLUG, WORKFLOW_STEPS } from "@/lib/i18n";
import { TasksExplorer } from "@/components/tasks/TasksExplorer";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/months/$month")({
  component: MonthPage,
  head: ({ params }) => {
    const m = MONTH_BY_SLUG[params.month];
    return { meta: [{ title: m ? `${m.label} — Elsewedy Task Flow` : "شهر" }] };
  },
});

function MonthPage() {
  const { month } = useParams({ from: "/_authenticated/months/$month" });
  const staticM = MONTH_BY_SLUG[month];
  const [uid, setUid] = useState<string | undefined>();
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id)); }, []);

  // If no static entry, try loading from DB by slug (months created via admin page).
  const { data: dbMonth, isLoading } = useQuery({
    enabled: !staticM,
    queryKey: ["month-by-slug", month],
    queryFn: async () => {
      const { data } = await supabase.from("months").select("*").eq("slug", month).maybeSingle();
      return data;
    },
  });

  if (!staticM && isLoading) return <div className="p-8 text-muted-foreground">جارٍ التحميل…</div>;
  if (!staticM && !dbMonth) throw notFound();

  const m = staticM ?? {
    slug: dbMonth!.slug,
    code: dbMonth!.month_code ?? dbMonth!.slug.toUpperCase().slice(0, 3),
    label: dbMonth!.name_ar,
    emoji: dbMonth!.emoji ?? "📅",
    verse: dbMonth!.verse ?? "",
    ref: dbMonth!.verse_ref ?? "",
    line: dbMonth!.line ?? "",
  };

  return (
    <div className="space-y-6">
      <div className="relative rounded-2xl overflow-hidden card-elev">
        <div className="brand-gradient p-8 md:p-12 text-white">
          <div className="text-6xl mb-2">{m.emoji}</div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">{m.label}</h1>
          {(m.verse || m.line) && (
            <div className="mt-6 max-w-2xl">
              {m.verse && <p className="text-2xl md:text-3xl font-semibold leading-relaxed">{m.verse}</p>}
              {m.ref && <p className="mt-2 text-sm opacity-90">{m.ref}</p>}
              {m.line && <><div className="mt-6 h-px bg-white/30" /><p className="mt-4 text-lg opacity-95">{m.line}</p></>}
            </div>
          )}
        </div>
      </div>

      <Card className="card-soft">
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-muted-foreground mb-4">مسار العمل</h2>
          <div className="flex flex-wrap items-center gap-2">
            {WORKFLOW_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className="rounded-full border px-3 py-1.5 text-sm bg-background flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded-full brand-gradient text-white text-xs flex items-center justify-center">{i + 1}</span>
                  {s}
                </div>
                {i < WORKFLOW_STEPS.length - 1 && <ArrowLeft className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-bold mb-4">مهام {m.label}</h2>
        <TasksExplorer monthCode={m.code} currentUserId={uid} />
      </div>
    </div>
  );
}
