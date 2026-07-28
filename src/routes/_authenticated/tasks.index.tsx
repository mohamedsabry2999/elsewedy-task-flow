import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { TasksExplorer } from "@/components/tasks/TasksExplorer";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
  head: () => ({ meta: [{ title: "كل المهام — Elsewedy Task Flow" }] }),
});

function TasksPage() {
  const [uid, setUid] = useState<string | undefined>();
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUid(data.user?.id)); }, []);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">كل المهام</h1>
          <p className="text-sm text-muted-foreground">قائمة موحدة لكل مهام السيلز والتصميم</p>
        </div>
        <Button asChild className="gap-1"><Link to="/tasks/new"><Plus className="h-4 w-4" /> تاسك جديد</Link></Button>
      </div>
      <TasksExplorer currentUserId={uid} />
    </div>
  );
}
