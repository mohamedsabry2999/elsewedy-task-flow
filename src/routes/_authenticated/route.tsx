import { createFileRoute, redirect, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myRoles, listNotifications, markNotificationRead } from "@/lib/tasks.functions";
import { ROLE_LABEL, MONTHS, type AppRole } from "@/lib/i18n";
import {
  LayoutDashboard, ListTodo, Calendar, ShieldCheck, History, Settings, LogOut, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { isAdminRole } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const NAV_BASE = [
  { to: "/dashboard", label: "لوحة القيادة", icon: LayoutDashboard, admin: false },
  { to: "/tasks", label: "كل المهام", icon: ListTodo, admin: false },
  { to: "/team", label: "المستخدمون والصلاحيات", icon: ShieldCheck, admin: true },
  { to: "/activity", label: "سجل النشاط", icon: History, admin: false },
  { to: "/settings", label: "الإعدادات", icon: Settings, admin: false },
];

function AuthLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const location = useLocation();
  const rolesFn = useServerFn(myRoles);
  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles"], queryFn: () => rolesFn(),
  });

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary/40" dir="rtl">
      <aside className="fixed inset-y-0 right-0 w-64 border-l bg-sidebar text-sidebar-foreground p-4 flex flex-col gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <div className="h-9 w-9 rounded-lg brand-gradient flex items-center justify-center text-white font-bold">
            E
          </div>
          <div>
            <div className="text-base font-bold leading-tight">Elsewedy</div>
            <div className="text-xs text-muted-foreground">Task Flow</div>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV_BASE.filter((n) => !n.admin || isAdminRole(roles)).map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || location.pathname.startsWith(to + "/");
            return (
              <Link
                key={to} to={to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-2">
          <div className="px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Calendar className="h-3 w-3" /> شهور 2026
          </div>
          <div className="flex flex-col gap-1">
            {MONTHS.map((m) => {
              const to = `/months/${m.slug}` as const;
              const active = location.pathname === to;
              return (
                <Link key={m.slug} to={to}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                    active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-sidebar-accent"
                  }`}
                >
                  <span>{m.emoji}</span> <span>{m.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="mt-auto text-xs text-muted-foreground px-3">
          <div>الأدوار: {roles.map((r) => ROLE_LABEL[r as AppRole] ?? r).join("، ") || "—"}</div>
        </div>
      </aside>

      <div className="mr-64">
        <TopBar onSignOut={signOut} />
        <main className="px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function TopBar({ onSignOut }: { onSignOut: () => void }) {
  const notiFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const qc = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"], queryFn: () => notiFn(), refetchInterval: 30_000,
  });
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 backdrop-blur px-8 h-14">
      <div className="text-sm text-muted-foreground">
        دار السويدي للطباعة — نظام إدارة مهام السيلز والتصميم
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                  {unread}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80">
            <DropdownMenuLabel>الإشعارات</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground text-center">لا توجد إشعارات</div>
            )}
            {notifications.slice(0, 12).map((n) => (
              <DropdownMenuItem key={n.id} className="flex-col items-start gap-1"
                onClick={async () => {
                  if (!n.is_read) { await markFn({ data: { id: n.id } }); qc.invalidateQueries({ queryKey: ["notifications"] }); }
                }}>
                <div className="flex items-center gap-2 w-full">
                  {!n.is_read && <Badge variant="default" className="h-1.5 w-1.5 p-0 rounded-full" />}
                  <span className="text-sm font-medium">{n.title}</span>
                </div>
                <div className="text-xs text-muted-foreground">{n.body}</div>
                <div className="text-[10px] text-muted-foreground">{formatDateTime(n.created_at)}</div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-2">
          <LogOut className="h-4 w-4" /> تسجيل الخروج
        </Button>
      </div>
    </header>
  );
}
