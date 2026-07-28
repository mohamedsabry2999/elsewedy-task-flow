import { createFileRoute, redirect, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myRoles, listNotifications, markNotificationRead, markAllNotificationsRead, getNotificationPrefs } from "@/lib/tasks.functions";
import { listNavMonths, canManageStructure } from "@/lib/structure.functions";
import { ROLE_LABEL, MONTHS, type AppRole } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard, ListTodo, Calendar, ShieldCheck, History, Settings, LogOut, Bell, Menu, Volume2, VolumeX, CheckCheck, ExternalLink, X, SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDateTime } from "@/lib/format";
import { isAdminRole } from "@/lib/permissions";
import { BrandMark } from "@/components/brand/BrandMark";
import { BrandSplash } from "@/components/brand/BrandSplash";
import { playForNotificationOnce, initAudioChannel, isAudioUnlocked, markAudioUnlocked, requestDesktopPermission, currentDesktopPermission } from "@/lib/notification-audio";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  pendingComponent: () => <BrandSplash label="جارٍ تحميل مساحة العمل…" />,
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
  const rolesFn = useServerFn(myRoles);
  const { data: roles = [] } = useQuery({
    queryKey: ["my-roles"], queryFn: () => rolesFn(),
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-secondary/40" dir="rtl">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 right-0 w-64 border-l bg-sidebar text-sidebar-foreground p-4 flex-col gap-4 z-40">
        <SidebarBody roles={roles} onNavigate={() => {}} />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 p-4 bg-sidebar text-sidebar-foreground" dir="rtl">
          <SidebarBody roles={roles} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:mr-64">
        <TopBar onSignOut={signOut} onMenuClick={() => setMobileOpen(true)} />
        <main className="px-4 sm:px-6 lg:px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarBody({ roles, onNavigate }: { roles: string[]; onNavigate: () => void }) {
  const location = useLocation();
  const navMonthsFn = useServerFn(listNavMonths);
  const canStructFn = useServerFn(canManageStructure);
  const { data: navData } = useQuery({
    queryKey: ["nav-months"], queryFn: () => navMonthsFn(), staleTime: 60_000,
  });
  const { data: canStruct = false } = useQuery({
    queryKey: ["can-manage-structure"], queryFn: () => canStructFn(),
  });

  // Fallback to legacy MONTHS if DB is empty (should not happen after migration).
  const years = navData?.years ?? [];
  const months = navData?.months ?? [];
  const monthsByYear = new Map<string, any[]>();
  months.forEach((m: any) => {
    const arr = monthsByYear.get(m.year_id) ?? [];
    arr.push(m); monthsByYear.set(m.year_id, arr);
  });
  const useLegacy = years.length === 0 || months.length === 0;

  return (
    <>
      <Link to="/dashboard" onClick={onNavigate} className="flex items-center justify-center px-2 py-3 border-b border-sidebar-border/60">
        <BrandMark size="lg" priority className="mx-auto" />
      </Link>

      <nav className="flex flex-col gap-1">
        {NAV_BASE.filter((n) => !n.admin || isAdminRole(roles)).map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to || location.pathname.startsWith(to + "/");
          return (
            <Link
              key={to} to={to} onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          );
        })}
        {canStruct && (
          <Link to="/structure" onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
              location.pathname.startsWith("/structure") ? "bg-primary/10 text-primary font-semibold" : "hover:bg-sidebar-accent"
            }`}>
            <SlidersHorizontal className="h-4 w-4" />
            <span>إدارة السنوات والشهور</span>
          </Link>
        )}
      </nav>

      <div className="mt-2 space-y-3 overflow-y-auto">
        {useLegacy ? (
          <div>
            <div className="px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3 w-3" /> شهور 2026
            </div>
            <div className="flex flex-col gap-1">
              {MONTHS.map((m) => {
                const to = `/months/${m.slug}` as const;
                const active = location.pathname === to;
                return (
                  <Link key={m.slug} to={to} onClick={onNavigate}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                      active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-sidebar-accent"
                    }`}>
                    <span>{m.emoji}</span> <span>{m.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          years.map((y: any) => {
            const yMonths = monthsByYear.get(y.id) ?? [];
            if (yMonths.length === 0) return null;
            return (
              <div key={y.id}>
                <div className="px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-3 w-3" /> شهور {y.year}
                  {y.is_default && <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0">افتراضية</Badge>}
                </div>
                <div className="flex flex-col gap-1">
                  {yMonths.map((m: any) => {
                    const to = `/months/${m.slug}` as const;
                    const active = location.pathname === to;
                    return (
                      <Link key={m.id} to={to} onClick={onNavigate}
                        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                          active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-sidebar-accent"
                        }`}>
                        <span>{m.emoji ?? "📅"}</span>
                        <span>{m.name_ar}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-auto text-xs text-muted-foreground px-3">
        <div>الأدوار: {roles.map((r) => ROLE_LABEL[r as AppRole] ?? r).join("، ") || "—"}</div>
      </div>
    </>
  );
}


function TopBar({ onSignOut, onMenuClick }: { onSignOut: () => void; onMenuClick: () => void }) {
  const navigate = useNavigate();
  const notiFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const prefsFn = useServerFn(getNotificationPrefs);
  const qc = useQueryClient();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"], queryFn: () => notiFn(), refetchInterval: 30_000,
  });
  const { data: prefs } = useQuery({ queryKey: ["notif-prefs"], queryFn: () => prefsFn() });

  const unread = notifications.filter((n) => !n.is_read).length;
  const hasUrgent = notifications.some((n: any) => !n.is_read && n.severity === "urgent");

  const initedRef = useRef(false);
  const [soundOn, setSoundOn] = useState(true);
  const [audioReady, setAudioReady] = useState<boolean>(false);
  const [tab, setTab] = useState<"all" | "unread" | "urgent">("all");

  useEffect(() => { initAudioChannel(); setAudioReady(isAudioUnlocked()); }, []);

  // Play sound for newly arrived notifications (deduped across tabs + server).
  useEffect(() => {
    if (!notifications.length) return;
    if (!initedRef.current) { initedRef.current = true; return; }
    const enabled = prefs?.sounds_enabled !== false && soundOn && audioReady;
    const desktop = (prefs as any)?.desktop_enabled === true;
    if (!enabled && !desktop) return;
    for (const n of notifications) {
      if (n.is_read || (n as any).played_at) continue;
      playForNotificationOnce(n as any, {
        volumeNormal: (prefs?.volume_normal ?? 60) / 100,
        volumeUrgent: (prefs?.volume_urgent ?? 90) / 100,
        desktop,
      });
    }
  }, [notifications, prefs, soundOn, audioReady]);

  // Realtime
  useEffect(() => {
    let channel: any;
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id; if (!uid) return;
      channel = supabase.channel(`notif-${uid}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => qc.invalidateQueries({ queryKey: ["notifications"] }))
        .subscribe();
    });
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [qc]);

  const enableSound = async () => {
    markAudioUnlocked();
    setAudioReady(true);
    if (currentDesktopPermission() === "default") await requestDesktopPermission();
  };

  const openNotif = async (n: any) => {
    if (!n.is_read) { await markFn({ data: { id: n.id } }); qc.invalidateQueries({ queryKey: ["notifications"] }); }
    if (n.task_id) navigate({ to: "/tasks", search: { open: n.task_id } });
  };

  const filtered = tab === "unread"
    ? notifications.filter((n) => !n.is_read)
    : tab === "urgent"
    ? notifications.filter((n: any) => n.severity === "urgent")
    : notifications;

  return (
    <>
      {!audioReady && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-sm flex items-center justify-between gap-2 px-4 sm:px-6 lg:px-8 py-2">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>فعّل صوت التنبيهات وإشعارات سطح المكتب لتصلك المهام العاجلة فورًا.</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" onClick={enableSound}>تفعيل الآن</Button>
            <Button size="sm" variant="ghost" onClick={() => setAudioReady(true)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 backdrop-blur px-4 sm:px-6 lg:px-8 h-14">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
            <Menu className="h-5 w-5" />
          </Button>
          <BrandMark size="sm" className="lg:hidden" />
          <div className="hidden sm:block text-sm text-muted-foreground">
            دار السويدي للطباعة — نظام إدارة مهام السيلز والتصميم
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => { markAudioUnlocked(); setAudioReady(true); setSoundOn((v) => !v); }}
            title={soundOn ? "كتم الصوت" : "تفعيل الصوت"}>
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          <DropdownMenu onOpenChange={(v) => { if (v) { markAudioUnlocked(); setAudioReady(true); } }}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className={`h-5 w-5 ${hasUrgent ? "text-red-600" : ""}`} />
                {unread > 0 && (
                  <>
                    <span className={`absolute -top-1 -left-1 h-4 min-w-4 px-1 rounded-full text-white text-[10px] flex items-center justify-center ${
                      hasUrgent ? "bg-red-600" : "bg-primary"
                    }`}>{unread}</span>
                    {hasUrgent && (
                      <span className="absolute inset-0 rounded-full animate-ping bg-red-500/40" />
                    )}
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[22rem] sm:w-96 p-0">
              <div className="flex items-center justify-between px-3 py-2">
                <DropdownMenuLabel className="p-0">الإشعارات</DropdownMenuLabel>
                {unread > 0 && (
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs"
                    onClick={async () => { await markAllFn(); qc.invalidateQueries({ queryKey: ["notifications"] }); }}>
                    <CheckCheck className="h-3 w-3" /> قراءة الكل
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator />
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
                <TabsList className="grid grid-cols-3 mx-3 my-2 h-8">
                  <TabsTrigger value="all" className="text-xs">الكل ({notifications.length})</TabsTrigger>
                  <TabsTrigger value="unread" className="text-xs">غير المقروء ({unread})</TabsTrigger>
                  <TabsTrigger value="urgent" className="text-xs">عاجل</TabsTrigger>
                </TabsList>
                <TabsContent value={tab} className="mt-0">
                  <div className="max-h-96 overflow-y-auto">
                    {filtered.length === 0 && (
                      <div className="p-6 text-sm text-muted-foreground text-center">لا توجد إشعارات</div>
                    )}
                    {filtered.slice(0, 30).map((n: any) => (
                      <button key={n.id} onClick={() => openNotif(n)}
                        className={`w-full text-right flex-col items-start gap-1 px-3 py-2 border-b hover:bg-accent transition ${
                          !n.is_read ? "bg-primary/5" : ""
                        }`}>
                        <div className="flex items-center gap-2 w-full">
                          {!n.is_read && (
                            <span className={`h-1.5 w-1.5 rounded-full ${n.severity === "urgent" ? "bg-red-600" : "bg-primary"}`} />
                          )}
                          <span className="text-sm font-medium flex-1 text-right">{n.title}</span>
                          {n.severity === "urgent" && <Badge variant="destructive" className="text-[10px]">عاجل</Badge>}
                          {n.task_id && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                        </div>
                        <div className="text-xs text-muted-foreground text-right w-full">{n.body}</div>
                        <div className="text-[10px] text-muted-foreground text-right w-full">{formatDateTime(n.created_at)}</div>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={onSignOut} className="gap-2">
            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">تسجيل الخروج</span>
          </Button>
        </div>
      </header>
    </>
  );
}
