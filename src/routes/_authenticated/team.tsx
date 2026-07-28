import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProfiles } from "@/lib/tasks.functions";
import { adminCreateUser, adminSetRole, adminToggleActive } from "@/lib/admin.functions";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ROLES, ROLE_LABEL, type AppRole } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/team")({
  component: TeamPage,
  head: () => ({ meta: [{ title: "الفريق — Elsewedy Task Flow" }] }),
});

function TeamPage() {
  const qc = useQueryClient();
  const profilesFn = useServerFn(listProfiles);
  const createFn = useServerFn(adminCreateUser);
  const setRoleFn = useServerFn(adminSetRole);
  const toggleFn = useServerFn(adminToggleActive);

  const { data: users = [] } = useQuery({ queryKey: ["profiles-full"], queryFn: () => profilesFn() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "sales_executive" as AppRole });

  const createUser = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم"); setOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "sales_executive" });
      qc.invalidateQueries({ queryKey: ["profiles-full"] });
      qc.invalidateQueries({ queryKey: ["profiles-lite"] });
    },
    onError: (e: any) => toast.error(e.message || "فشل الإنشاء"),
  });

  const changeRole = useMutation({
    mutationFn: (v: { user_id: string; role: string }) => setRoleFn({ data: v }),
    onSuccess: () => { toast.success("تم تحديث الدور"); qc.invalidateQueries({ queryKey: ["profiles-full"] }); },
  });

  const toggle = useMutation({
    mutationFn: (v: { user_id: string; is_active: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profiles-full"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الفريق</h1>
          <p className="text-sm text-muted-foreground">إدارة أعضاء الفريق والصلاحيات</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button>إضافة عضو</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة مستخدم جديد</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>الاسم الكامل</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>البريد</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>كلمة المرور المؤقتة</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>الدور</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createUser.mutate()} disabled={createUser.isPending}>إنشاء</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="card-soft">
        <CardHeader><CardTitle className="text-base">الأعضاء ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>البريد</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>{(u.roles ?? []).map((r) => <Badge key={r} variant="secondary" className="ml-1">{ROLE_LABEL[r as AppRole] ?? r}</Badge>)}</TableCell>
                  <TableCell>{u.is_active ? <Badge variant="outline" className="border-emerald-300 text-emerald-700">نشط</Badge> : <Badge variant="outline" className="border-red-300 text-red-700">موقوف</Badge>}</TableCell>
                  <TableCell className="flex gap-2">
                    <Select value={(u.roles ?? [])[0] ?? ""} onValueChange={(v) => changeRole.mutate({ user_id: u.id, role: v })}>
                      <SelectTrigger className="w-36 h-8"><SelectValue placeholder="تغيير الدور" /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={() => toggle.mutate({ user_id: u.id, is_active: !u.is_active })}>
                      {u.is_active ? "إيقاف" : "تفعيل"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
