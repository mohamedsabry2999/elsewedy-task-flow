import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProfiles, myRoles } from "@/lib/tasks.functions";
import {
  adminCreateUser, adminSetRole, adminToggleActive,
  adminUpdateProfile, adminResetPassword, adminArchiveUser,
  adminListOverrides, adminSetOverride,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, ROLE_LABEL, type AppRole } from "@/lib/i18n";
import {
  PERMISSIONS, PERMISSION_MATRIX, PERM_LABEL, PERM_COLOR, type PermState,
} from "@/lib/permissions";
import { formatDate } from "@/lib/format";
import {
  Users, UserPlus, Search, ShieldCheck, MoreHorizontal,
  UserCog, KeyRound, Archive, Power, Eye,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/team")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
    const rs = (roles ?? []).map((r) => r.role as string);
    if (!rs.includes("super_admin") && !rs.includes("admin")) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: TeamPage,
  head: () => ({ meta: [{ title: "المستخدمون والصلاحيات — Elsewedy Task Flow" }] }),
});

const DEPARTMENTS = ["الإدارة", "المبيعات", "التصميم", "التسويق", "خدمة العملاء", "الإنتاج", "أخرى"];
const BRANCHES = ["مكتب القاهرة", "مصنع العاشر من رمضان", "العمل الهجين", "أخرى"];
const STATUSES = [
  { key: "active", label: "نشط" },
  { key: "suspended", label: "موقوف مؤقتاً" },
  { key: "archived", label: "مؤرشف" },
];

type UserRow = Awaited<ReturnType<typeof listProfiles>>[number] & {
  phone?: string | null;
  department?: string | null;
  job_title?: string | null;
  branch?: string | null;
  archived_at?: string | null;
  last_sign_in_at?: string | null;
  avatar_url?: string | null;
};

function TeamPage() {
  const qc = useQueryClient();
  const profilesFn = useServerFn(listProfiles);
  const rolesFn = useServerFn(myRoles);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["profiles-full"], queryFn: () => profilesFn() as unknown as Promise<UserRow[]>,
  });
  const { data: myRolesArr = [] } = useQuery({ queryKey: ["my-roles"], queryFn: () => rolesFn() });
  const isSuper = myRolesArr.includes("super_admin");

  const [query, setQuery] = useState("");
  const [fRole, setFRole] = useState<string>("all");
  const [fDept, setFDept] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fBranch, setFBranch] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const roles = u.roles ?? [];
      if (fRole !== "all" && !roles.includes(fRole)) return false;
      if (fDept !== "all" && (u.department ?? "") !== fDept) return false;
      if (fBranch !== "all" && (u.branch ?? "") !== fBranch) return false;
      if (fStatus === "active" && (!u.is_active || u.archived_at)) return false;
      if (fStatus === "suspended" && (u.is_active || u.archived_at)) return false;
      if (fStatus === "archived" && !u.archived_at) return false;
      if (q) {
        const hay = `${u.full_name ?? ""} ${u.email ?? ""} ${u.phone ?? ""} ${u.job_title ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, query, fRole, fDept, fBranch, fStatus]);

  const kpis = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.is_active && !u.archived_at).length;
    const suspended = users.filter((u) => !u.is_active && !u.archived_at).length;
    const sales = users.filter((u) => (u.roles ?? []).some((r: string) => r === "sales_manager" || r === "sales_executive")).length;
    const design = users.filter((u) => (u.roles ?? []).some((r: string) => r === "design_manager" || r === "designer")).length;
    const managers = users.filter((u) => (u.roles ?? []).some((r: string) => r === "super_admin" || r === "admin" || r === "sales_manager" || r === "design_manager")).length;
    return { total, active, suspended, sales, design, managers };
  }, [users]);

  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<UserRow | null>(null);
  const [permsUserId, setPermsUserId] = useState<string | null>(null);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl brand-gradient flex items-center justify-center text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">المستخدمون والصلاحيات</h1>
            <p className="text-sm text-muted-foreground">إدارة أعضاء الفريق والأدوار ومستويات الوصول</p>
          </div>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> إضافة مستخدم جديد
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="إجمالي المستخدمين" value={kpis.total} />
        <KpiCard label="المستخدمون النشطون" value={kpis.active} tone="emerald" />
        <KpiCard label="الحسابات الموقوفة" value={kpis.suspended} tone="red" />
        <KpiCard label="فريق المبيعات" value={kpis.sales} tone="blue" />
        <KpiCard label="فريق التصميم" value={kpis.design} tone="orange" />
        <KpiCard label="المديرون" value={kpis.managers} tone="purple" />
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="matrix">مصفوفة الصلاحيات</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card className="card-soft">
            <CardContent className="p-4 flex flex-wrap gap-3 items-end">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)}
                  className="pr-9" placeholder="ابحث بالاسم أو البريد أو الهاتف..." />
              </div>
              <FilterSelect label="الدور" value={fRole} onChange={setFRole}
                options={[{ v: "all", l: "كل الأدوار" }, ...ROLES.map((r) => ({ v: r, l: ROLE_LABEL[r] }))]} />
              <FilterSelect label="القسم" value={fDept} onChange={setFDept}
                options={[{ v: "all", l: "كل الأقسام" }, ...DEPARTMENTS.map((d) => ({ v: d, l: d }))]} />
              <FilterSelect label="الفرع" value={fBranch} onChange={setFBranch}
                options={[{ v: "all", l: "كل الفروع" }, ...BRANCHES.map((b) => ({ v: b, l: b }))]} />
              <FilterSelect label="الحالة" value={fStatus} onChange={setFStatus}
                options={[{ v: "all", l: "كل الحالات" }, ...STATUSES.map((s) => ({ v: s.key, l: s.label }))]} />
            </CardContent>
          </Card>

          <Card className="card-soft">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" /> الأعضاء ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">البريد</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-right">القسم</TableHead>
                      <TableHead className="text-right">المسمى الوظيفي</TableHead>
                      <TableHead className="text-right">الدور</TableHead>
                      <TableHead className="text-right">الفرع</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">آخر دخول</TableHead>
                      <TableHead className="text-right">إنشاء الحساب</TableHead>
                      <TableHead className="text-right">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
                    )}
                    {!isLoading && filtered.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">لا توجد نتائج مطابقة</TableCell></TableRow>
                    )}
                    {filtered.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar_url ?? undefined} />
                              <AvatarFallback>{(u.full_name || u.email || "?").slice(0, 1)}</AvatarFallback>
                            </Avatar>
                            <div className="font-medium">{u.full_name || "—"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{u.email}</TableCell>
                        <TableCell>{u.phone || "—"}</TableCell>
                        <TableCell>{u.department || "—"}</TableCell>
                        <TableCell>{u.job_title || "—"}</TableCell>
                        <TableCell>
                          {(u.roles ?? []).map((r) => (
                            <Badge key={r} variant="secondary" className="ml-1">{ROLE_LABEL[r as AppRole] ?? r}</Badge>
                          ))}
                        </TableCell>
                        <TableCell>{u.branch || "—"}</TableCell>
                        <TableCell>
                          {u.archived_at
                            ? <Badge variant="outline" className="border-slate-300 text-slate-600">مؤرشف</Badge>
                            : u.is_active
                              ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">نشط</Badge>
                              : <Badge variant="outline" className="border-red-300 text-red-700">موقوف</Badge>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate((u as any).created_at)}</TableCell>
                        <TableCell>
                          <RowActions user={u} isSuper={isSuper}
                            onDetail={() => setDetail(u)}
                            onPerms={() => setPermsUserId(u.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          <PermissionMatrix />
        </TabsContent>
      </Tabs>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} isSuper={isSuper}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["profiles-full"] }); qc.invalidateQueries({ queryKey: ["profiles-lite"] }); }} />

      {detail && (
        <UserDetailDialog user={detail} open={!!detail} onClose={() => setDetail(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["profiles-full"] })} />
      )}

      {permsUserId && (
        <UserOverridesDialog userId={permsUserId} open={!!permsUserId} onClose={() => setPermsUserId(null)} />
      )}
    </div>
  );
}

function KpiCard({ label, value, tone = "slate" }: { label: string; value: number; tone?: string }) {
  const map: Record<string, string> = {
    slate: "text-slate-700", emerald: "text-emerald-700", red: "text-red-700",
    blue: "text-blue-700", orange: "text-orange-700", purple: "text-purple-700",
  };
  return (
    <Card className="card-soft">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${map[tone]}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="min-w-[140px]">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function RowActions({ user, isSuper, onDetail, onPerms }:
  { user: UserRow; isSuper: boolean; onDetail: () => void; onPerms: () => void }) {
  const qc = useQueryClient();
  const setRoleFn = useServerFn(adminSetRole);
  const toggleFn = useServerFn(adminToggleActive);
  const archiveFn = useServerFn(adminArchiveUser);
  const resetFn = useServerFn(adminResetPassword);

  const [confirm, setConfirm] = useState<null | { title: string; body: string; run: () => Promise<void> }>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPass, setNewPass] = useState("");

  const changeRole = useMutation({
    mutationFn: (role: string) => setRoleFn({ data: { user_id: user.id, role: role as any } }),
    onSuccess: () => { toast.success("تم تحديث الدور"); qc.invalidateQueries({ queryKey: ["profiles-full"] }); },
    onError: (e: any) => toast.error(e.message || "فشل تحديث الدور"),
  });
  const toggleActive = useMutation({
    mutationFn: () => toggleFn({ data: { user_id: user.id, is_active: !user.is_active } }),
    onSuccess: () => { toast.success(user.is_active ? "تم إيقاف الحساب" : "تم تفعيل الحساب"); qc.invalidateQueries({ queryKey: ["profiles-full"] }); },
    onError: (e: any) => toast.error(e.message || "فشل التنفيذ"),
  });
  const archive = useMutation({
    mutationFn: () => archiveFn({ data: { user_id: user.id, archive: !user.archived_at } }),
    onSuccess: () => { toast.success(user.archived_at ? "تم استرجاع الحساب" : "تمت أرشفة الحساب"); qc.invalidateQueries({ queryKey: ["profiles-full"] }); },
    onError: (e: any) => toast.error(e.message || "فشل التنفيذ"),
  });
  const reset = useMutation({
    mutationFn: () => resetFn({ data: { user_id: user.id, new_password: newPass } }),
    onSuccess: () => { toast.success("تم إعادة تعيين كلمة المرور"); setResetOpen(false); setNewPass(""); },
    onError: (e: any) => toast.error(e.message || "فشل إعادة التعيين"),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56" dir="rtl">
          <DropdownMenuLabel>الإجراءات</DropdownMenuLabel>
          <DropdownMenuItem onClick={onDetail}><Eye className="h-4 w-4 ml-2" /> عرض / تعديل البيانات</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs text-muted-foreground">تغيير الدور</DropdownMenuLabel>
          {ROLES.map((r) => {
            const isProtected = (r === "super_admin" || r === "admin") && !isSuper;
            return (
              <DropdownMenuItem key={r} disabled={isProtected}
                onClick={() => setConfirm({
                  title: "تأكيد تغيير الدور",
                  body: `تغيير دور ${user.full_name || user.email} إلى ${ROLE_LABEL[r]}؟`,
                  run: async () => { await changeRole.mutateAsync(r); },
                })}>
                <UserCog className="h-4 w-4 ml-2" /> {ROLE_LABEL[r]}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onPerms}><ShieldCheck className="h-4 w-4 ml-2" /> تعديل الصلاحيات</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResetOpen(true)}><KeyRound className="h-4 w-4 ml-2" /> إعادة تعيين كلمة المرور</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfirm({
            title: user.is_active ? "إيقاف الحساب" : "تفعيل الحساب",
            body: user.is_active ? "سيتم منع المستخدم من الدخول." : "سيتمكن المستخدم من الدخول مرة أخرى.",
            run: async () => { await toggleActive.mutateAsync(); },
          })}>
            <Power className="h-4 w-4 ml-2" /> {user.is_active ? "إيقاف الحساب" : "إعادة تفعيل الحساب"}
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirm({
            title: user.archived_at ? "استرجاع الحساب" : "أرشفة الحساب",
            body: user.archived_at ? "سيعود الحساب للعمل." : "سيتم أرشفة الحساب مع الحفاظ على السجل التاريخي.",
            run: async () => { await archive.mutateAsync(); },
          })}>
            <Archive className="h-4 w-4 ml-2" /> {user.archived_at ? "استرجاع الحساب" : "أرشفة الحساب"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await confirm?.run(); setConfirm(null); }}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
            <DialogDescription>أدخل كلمة مرور مؤقتة جديدة لـ {user.full_name || user.email}</DialogDescription>
          </DialogHeader>
          <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
            placeholder="8 أحرف على الأقل" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>إلغاء</Button>
            <Button onClick={() => reset.mutate()} disabled={newPass.length < 8 || reset.isPending}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AddUserDialog({ open, onOpenChange, onCreated, isSuper }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; isSuper: boolean;
}) {
  const createFn = useServerFn(adminCreateUser);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", password: "",
    department: "", job_title: "", branch: "",
    role: "sales_executive" as AppRole,
  });
  const reset = () => { setStep(1); setForm({ full_name: "", email: "", phone: "", password: "", department: "", job_title: "", branch: "", role: "sales_executive" }); };

  const m = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => { toast.success("تم إنشاء المستخدم بنجاح"); reset(); onOpenChange(false); onCreated(); },
    onError: (e: any) => toast.error(e.message || "فشل إنشاء المستخدم"),
  });

  const canNext1 = form.full_name.trim() && form.email.includes("@");
  const canNext2 = form.password.length >= 8 && form.role;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>إضافة مستخدم جديد — الخطوة {step} من 3</DialogTitle>
          <DialogDescription>
            {step === 1 && "البيانات الشخصية للمستخدم"}
            {step === 2 && "الدور وكلمة المرور المؤقتة"}
            {step === 3 && "مراجعة وتأكيد"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-3">
            <F label="الاسم الكامل *"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></F>
            <F label="البريد الإلكتروني *"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></F>
            <F label="رقم الهاتف"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
            <F label="القسم">
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="اختر القسم" /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="المسمى الوظيفي"><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></F>
            <F label="الفرع">
              <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </F>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-3">
            <F label="الدور *">
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => {
                    const restricted = (r === "super_admin" || r === "admin") && !isSuper;
                    return <SelectItem key={r} value={r} disabled={restricted}>{ROLE_LABEL[r]}{restricted ? " — يتطلب سوبر أدمن" : ""}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </F>
            <F label="كلمة المرور المؤقتة *">
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8 أحرف على الأقل" />
            </F>
            <p className="text-xs text-muted-foreground">سيتمكن المستخدم من تغيير كلمة المرور بعد الدخول لأول مرة.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm">
            <Row k="الاسم" v={form.full_name} />
            <Row k="البريد" v={form.email} />
            <Row k="الهاتف" v={form.phone || "—"} />
            <Row k="القسم" v={form.department || "—"} />
            <Row k="المسمى الوظيفي" v={form.job_title || "—"} />
            <Row k="الفرع" v={form.branch || "—"} />
            <Row k="الدور" v={ROLE_LABEL[form.role]} />
          </div>
        )}

        <DialogFooter className="flex-row-reverse gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>السابق</Button>}
          {step < 3 && (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canNext1 : !canNext2}
            >التالي</Button>
          )}
          {step === 3 && <Button onClick={() => m.mutate()} disabled={m.isPending}>إنشاء الحساب</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b py-1"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}

function UserDetailDialog({ user, open, onClose, onSaved }:
  { user: UserRow; open: boolean; onClose: () => void; onSaved: () => void }) {
  const updateFn = useServerFn(adminUpdateProfile);
  const [form, setForm] = useState({
    full_name: user.full_name ?? "", phone: user.phone ?? "",
    department: user.department ?? "", job_title: user.job_title ?? "", branch: user.branch ?? "",
  });
  const m = useMutation({
    mutationFn: () => updateFn({ data: { user_id: user.id, ...form } as any }),
    onSuccess: () => { toast.success("تم الحفظ"); onSaved(); onClose(); },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>تعديل بيانات {user.full_name || user.email}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <F label="الاسم الكامل"><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></F>
          <F label="الهاتف"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></F>
          <F label="القسم">
            <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </F>
          <F label="المسمى الوظيفي"><Input value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} /></F>
          <F label="الفرع">
            <Select value={form.branch} onValueChange={(v) => setForm({ ...form, branch: v })}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>{BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </F>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UserOverridesDialog({ userId, open, onClose }:
  { userId: string; open: boolean; onClose: () => void }) {
  const listFn = useServerFn(adminListOverrides);
  const setFn = useServerFn(adminSetOverride);
  const qc = useQueryClient();
  const { data: overrides = [] } = useQuery({
    queryKey: ["overrides", userId],
    queryFn: () => listFn({ data: { user_id: userId } }),
  });
  const overrideMap = new Map(overrides.map((o: any) => [o.permission_key, o.value as PermState]));

  const m = useMutation({
    mutationFn: (v: { key: string; value: PermState | null }) =>
      setFn({ data: { user_id: userId, permission_key: v.key, value: v.value } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["overrides", userId] }); },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل الصلاحيات المخصصة</DialogTitle>
          <DialogDescription>هذه الصلاحيات تُطبق فوق الصلاحيات الأساسية للدور.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {PERMISSIONS.map((p) => {
            const current = overrideMap.get(p.key) ?? null;
            return (
              <div key={p.key} className="flex items-center justify-between border rounded-md p-2 gap-3">
                <div className="text-sm">{p.label}</div>
                <Select value={current ?? "inherit"} onValueChange={(v) => m.mutate({ key: p.key, value: v === "inherit" ? null : (v as PermState) })}>
                  <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inherit">الأصلية للدور</SelectItem>
                    <SelectItem value="allow">{PERM_LABEL.allow}</SelectItem>
                    <SelectItem value="own">{PERM_LABEL.own}</SelectItem>
                    <SelectItem value="read">{PERM_LABEL.read}</SelectItem>
                    <SelectItem value="deny">{PERM_LABEL.deny}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
        <DialogFooter><Button onClick={onClose}>إغلاق</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PermissionMatrix() {
  return (
    <Card className="card-soft">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> مصفوفة الصلاحيات الأساسية للأدوار
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right sticky right-0 bg-background">الصلاحية</TableHead>
              {ROLES.map((r) => <TableHead key={r} className="text-center whitespace-nowrap">{ROLE_LABEL[r]}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSIONS.map((p) => (
              <TableRow key={p.key}>
                <TableCell className="sticky right-0 bg-background font-medium text-right">{p.label}</TableCell>
                {ROLES.map((r) => {
                  const v = PERMISSION_MATRIX[p.key][r];
                  return (
                    <TableCell key={r} className="text-center">
                      <Badge variant="outline" className={PERM_COLOR[v]}>{PERM_LABEL[v]}</Badge>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
