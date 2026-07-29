import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listYears, createYear, updateYear, deleteYear,
  listMonths, createMonth, bulkCreateMonths, updateMonth, deleteMonth,
  listStructureAudit, canManageStructure,
  listTemplates, createTemplate, updateTemplate, deleteTemplate, assignTemplateToMonth,
} from "@/lib/structure.functions";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Archive, ArchiveRestore, Calendar, Copy, FileStack, Layers, Plus, ShieldAlert, Star, Trash2, Columns3, ArrowUp, ArrowDown, Eye, EyeOff, ListPlus, Flag, X } from "lucide-react";

import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";

const MONTH_NAMES = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

export const Route = createFileRoute("/_authenticated/structure")({
  component: StructurePage,
  head: () => ({ meta: [{ title: "إدارة السنوات والشهور — Elsewedy Task Flow" }] }),
});

function StructurePage() {
  const canFn = useServerFn(canManageStructure);
  const { data: canManage, isLoading: checking } = useQuery({
    queryKey: ["can-manage-structure"], queryFn: () => canFn(),
  });

  if (checking) return <div className="p-8 text-muted-foreground">جارٍ التحقق من الصلاحية…</div>;

  if (canManage !== true) {
    return (
      <Card className="card-soft max-w-lg mx-auto">
        <CardContent className="p-8 text-center space-y-3">
          <ShieldAlert className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-lg font-bold">صفحة محمية</h2>
          <p className="text-sm text-muted-foreground">
            هذه الصفحة متاحة فقط لـ Super Admin أو مشرف النظام أو من لديه صلاحية <code>manage_task_structure</code>.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إدارة هيكل النظام</h1>
        <p className="text-sm text-muted-foreground">الأقسام وأنواع المهام والسنوات والشهور وقوالب المهام.</p>
      </div>
      <Tabs defaultValue="departments" dir="rtl">
        <TabsList>
          <TabsTrigger value="departments">الأقسام</TabsTrigger>
          <TabsTrigger value="task-types">أنواع المهام</TabsTrigger>
          <TabsTrigger value="years">السنوات والشهور</TabsTrigger>
          <TabsTrigger value="templates">القوالب</TabsTrigger>
          <TabsTrigger value="audit">سجل التعديلات</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4"><DepartmentsPanel /></TabsContent>
        <TabsContent value="task-types" className="mt-4"><TaskTypesPanel /></TabsContent>
        <TabsContent value="years" className="mt-4"><YearsPanel /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesPanel /></TabsContent>
        <TabsContent value="audit" className="mt-4"><AuditPanel /></TabsContent>
      </Tabs>

    </div>
  );
}

function YearsPanel() {
  const qc = useQueryClient();
  const yearsFn = useServerFn(listYears);
  const { data: years = [] } = useQuery({
    queryKey: ["structure-years"], queryFn: () => yearsFn(),
  });
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const currentYearId = selectedYearId ?? years[0]?.id ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="card-soft lg:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">السنوات</CardTitle>
          <NewYearDialog existingYears={years.map((y: any) => y.year)} />
        </CardHeader>
        <CardContent className="space-y-2">
          {years.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">لا توجد سنوات بعد.</div>
          )}
          {years.map((y: any) => (
            <YearRow key={y.id} year={y} selected={currentYearId === y.id}
              onSelect={() => setSelectedYearId(y.id)} />
          ))}
        </CardContent>
      </Card>
      <Card className="card-soft lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> شهور السنة
          </CardTitle>
          {currentYearId && <NewMonthDialog yearId={currentYearId} />}
        </CardHeader>
        <CardContent>
          {currentYearId
            ? <MonthsList yearId={currentYearId} />
            : <div className="text-sm text-muted-foreground text-center py-6">اختر سنة لعرض شهورها.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function YearRow({ year, selected, onSelect }: { year: any; selected: boolean; onSelect: () => void }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateYear);
  const delFn = useServerFn(deleteYear);
  const upd = useMutation({
    mutationFn: (patch: any) => updFn({ data: { id: year.id, patch } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["structure-years"] }); qc.invalidateQueries({ queryKey: ["nav-months"] }); },
    onError: (e: any) => toast.error(e.message || "فشل التحديث"),
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: year.id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["structure-years"] }); },
    onError: (e: any) => toast.error(e.message || "تعذّر الحذف"),
  });
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-2 transition ${selected ? "bg-primary/5 border-primary/40" : "hover:bg-muted/40"}`}>
      <button onClick={onSelect} className="text-right flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{year.year}</span>
          {year.is_default && <Badge className="bg-emerald-100 text-emerald-800">افتراضية</Badge>}
          {year.is_archived && <Badge variant="outline">مؤرشفة</Badge>}
          {!year.is_active && !year.is_archived && <Badge variant="outline">غير نشطة</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          {year.months_count} شهر · {year.tasks_count} تاسك
        </div>
      </button>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => upd.mutate({ is_default: true })} disabled={year.is_default}>
          <Star className="h-3.5 w-3.5 ml-1" /> جعلها افتراضية
        </Button>
        {year.is_archived ? (
          <Button size="sm" variant="outline" onClick={() => upd.mutate({ is_archived: false, is_active: true })}>
            <ArchiveRestore className="h-3.5 w-3.5 ml-1" /> إعادة تفعيل
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => upd.mutate({ is_archived: true, is_active: false, is_default: false })}>
            <Archive className="h-3.5 w-3.5 ml-1" /> أرشفة
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="ghost" className="text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>حذف السنة {year.year}؟</AlertDialogTitle>
              <AlertDialogDescription>
                لا يمكن حذف السنة إذا كانت تحتوي على تاسكات. يفضل أرشفتها.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => del.mutate()}>حذف</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function NewYearDialog({ existingYears }: { existingYears: number[] }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createYear);
  const yearsFn = useServerFn(listYears);
  const { data: years = [] } = useQuery({ queryKey: ["structure-years"], queryFn: () => yearsFn() });
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState<number>(new Date().getFullYear() + 1);
  const [mode, setMode] = useState<"empty" | "all12" | "custom" | "copy">("all12");
  const [nums, setNums] = useState<number[]>([]);
  const [copyFrom, setCopyFrom] = useState<string>("");

  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      year,
      seed_all_months: mode === "all12",
      seed_month_nums: mode === "custom" ? nums : [],
      copy_from_year_id: mode === "copy" && copyFrom ? copyFrom : null,
    } }),
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["structure-years"] });
      qc.invalidateQueries({ queryKey: ["nav-months"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "تعذّرت الإضافة"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 ml-1" /> سنة جديدة</Button></DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إضافة سنة جديدة</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>السنة</Label>
            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value || "0", 10))} />
            {existingYears.includes(year) && <p className="text-xs text-red-600 mt-1">هذه السنة موجودة بالفعل</p>}
          </div>
          <div className="space-y-2">
            <Label>طريقة الإنشاء</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="empty">سنة فارغة (بدون شهور)</SelectItem>
                <SelectItem value="all12">إنشاء 12 شهرًا تلقائيًا</SelectItem>
                <SelectItem value="custom">اختيار شهور محددة</SelectItem>
                <SelectItem value="copy">نسخ إعدادات سنة سابقة (بدون تاسكات)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "custom" && (
            <div className="grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((n, i) => {
                const val = i + 1;
                return (
                  <label key={val} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={nums.includes(val)}
                      onCheckedChange={(c) => setNums((p) => c ? [...p, val] : p.filter((x) => x !== val))}
                    />
                    <span>{n}</span>
                  </label>
                );
              })}
            </div>
          )}
          {mode === "copy" && (
            <div>
              <Label>السنة المصدر</Label>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger><SelectValue placeholder="اختر سنة" /></SelectTrigger>
                <SelectContent>
                  {years.map((y: any) => (
                    <SelectItem key={y.id} value={y.id}>{y.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()}
            disabled={existingYears.includes(year) || mut.isPending || (mode === "copy" && !copyFrom)}>
            إنشاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MonthsList({ yearId }: { yearId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMonths);
  const updFn = useServerFn(updateMonth);
  const delFn = useServerFn(deleteMonth);
  const bulkFn = useServerFn(bulkCreateMonths);

  const { data: months = [] } = useQuery({
    queryKey: ["structure-months", yearId],
    queryFn: () => listFn({ data: { year_id: yearId } }),
  });

  const upd = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) => updFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["structure-months", yearId] }); qc.invalidateQueries({ queryKey: ["nav-months"] }); },
    onError: (e: any) => toast.error(e.message || "فشل التحديث"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["structure-months", yearId] }); qc.invalidateQueries({ queryKey: ["nav-months"] }); },
    onError: (e: any) => toast.error(e.message || "تعذّر الحذف"),
  });
  const seedAll = useMutation({
    mutationFn: () => bulkFn({ data: { year_id: yearId, month_nums: Array.from({ length: 12 }, (_, i) => i + 1) } }),
    onSuccess: (r: any) => { toast.success(`تم إضافة ${r.inserted} شهر`); qc.invalidateQueries({ queryKey: ["structure-months", yearId] }); qc.invalidateQueries({ queryKey: ["nav-months"] }); },
    onError: (e: any) => toast.error(e.message || "تعذّرت الإضافة"),
  });

  return (
    <div className="space-y-2">
      {months.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 flex flex-col items-center gap-2">
          <div>لا توجد شهور في هذه السنة.</div>
          <Button size="sm" variant="outline" onClick={() => seedAll.mutate()}>إنشاء 12 شهرًا تلقائيًا</Button>
        </div>
      )}
      {months.map((m: any) => (
        <div key={m.id} className="rounded-lg border p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="w-10 text-center font-bold text-lg text-muted-foreground">{String(m.month_num).padStart(2, "0")}</div>
            <div className="flex-1 min-w-[160px]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{m.emoji ?? ""}</span>
                <span className="font-medium">{m.name_ar}</span>
                {m.is_default && <Badge className="bg-emerald-100 text-emerald-800">افتراضي</Badge>}
                {m.is_archived && <Badge variant="outline">مؤرشف</Badge>}
                {m.is_hidden && <Badge variant="outline">مخفي</Badge>}
                {m.month_code && <Badge variant="secondary" className="font-mono">{m.month_code}</Badge>}
              </div>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: m.id, patch: { is_default: true } })} disabled={m.is_default}>
                <Star className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: m.id, patch: { is_hidden: !m.is_hidden } })}>
                {m.is_hidden ? "إظهار" : "إخفاء"}
              </Button>
              {m.is_archived ? (
                <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: m.id, patch: { is_archived: false } })}>
                  <ArchiveRestore className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: m.id, patch: { is_archived: true } })}>
                  <Archive className="h-3.5 w-3.5" />
                </Button>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-red-600"><Trash2 className="h-3.5 w-3.5" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف {m.name_ar}؟</AlertDialogTitle>
                    <AlertDialogDescription>لا يمكن الحذف إذا كان الشهر يحتوي على تاسكات. يمكن أرشفته بدلًا من ذلك.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => del.mutate(m.id)}>حذف</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <MonthTemplateSelect monthId={m.id} currentTemplateId={m.template_id} />
        </div>
      ))}

    </div>
  );
}

function NewMonthDialog({ yearId }: { yearId: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createMonth);
  const listFn = useServerFn(listMonths);
  const { data: existing = [] } = useQuery({
    queryKey: ["structure-months", yearId], queryFn: () => listFn({ data: { year_id: yearId } }),
  });
  const existingNums = new Set((existing as any[]).map((m) => m.month_num));
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState<number>(1);

  const mut = useMutation({
    mutationFn: () => createFn({ data: { year_id: yearId, month_num: num } }),
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["structure-months", yearId] });
      qc.invalidateQueries({ queryKey: ["nav-months"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "تعذّرت الإضافة"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4 ml-1" /> شهر</Button></DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إضافة شهر</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>الشهر</Label>
          <Select value={String(num)} onValueChange={(v) => setNum(parseInt(v, 10))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((n, i) => {
                const v = i + 1;
                return (
                  <SelectItem key={v} value={String(v)} disabled={existingNums.has(v)}>
                    {String(v).padStart(2, "0")} — {n} {existingNums.has(v) ? "(موجود)" : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={existingNums.has(num) || mut.isPending}>إضافة</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuditPanel() {
  const auditFn = useServerFn(listStructureAudit);
  const { data: rows = [] } = useQuery({
    queryKey: ["structure-audit"], queryFn: () => auditFn({ data: { limit: 200 } }),
  });
  return (
    <Card className="card-soft">
      <CardHeader><CardTitle className="text-base">{rows.length} حدث</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">لا يوجد نشاط بعد.</div>}
        <div className="space-y-2">
          {rows.map((r: any) => (
            <div key={r.id} className="border rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{r.entity_type}</Badge>
                  <span className="font-medium">{r.action}</span>
                </div>
                <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
              </div>
              {(r.before || r.after || Object.keys(r.details || {}).length > 0) && (
                <pre className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/40 p-2 rounded">
{JSON.stringify({ before: r.before, after: r.after, details: r.details }, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TEMPLATES PANEL
// ============================================================

function useTemplates() {
  const listFn = useServerFn(listTemplates);
  return useQuery({ queryKey: ["structure-templates"], queryFn: () => listFn(), staleTime: 30_000 });
}

function MonthTemplateSelect({ monthId, currentTemplateId }: { monthId: string; currentTemplateId: string | null }) {
  const qc = useQueryClient();
  const { data: templates = [] } = useTemplates();
  const assignFn = useServerFn(assignTemplateToMonth);
  const mut = useMutation({
    mutationFn: (tid: string | null) => assignFn({ data: { month_id: monthId, template_id: tid } }),
    onSuccess: () => {
      toast.success("تم تحديث القالب");
      qc.invalidateQueries({ queryKey: ["structure-months"] });
      qc.invalidateQueries({ queryKey: ["structure-templates"] });
    },
    onError: (e: any) => toast.error(e.message || "تعذّر التحديث"),
  });
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-dashed">
      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">القالب:</span>
      <Select value={currentTemplateId ?? "__none__"} onValueChange={(v) => mut.mutate(v === "__none__" ? null : v)}>
        <SelectTrigger className="h-8 text-xs flex-1 max-w-[280px]"><SelectValue placeholder="اختر قالبًا" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— بدون قالب —</SelectItem>
          {(templates as any[]).map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name} {t.is_system_default ? "★" : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function TemplatesPanel() {
  const qc = useQueryClient();
  const { data: templates = [], isLoading } = useTemplates();
  const delFn = useServerFn(deleteTemplate);
  const updFn = useServerFn(updateTemplate);
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["structure-templates"] }); },
    onError: (e: any) => toast.error(e.message || "تعذّر الحذف"),
  });
  const upd = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) => updFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["structure-templates"] }); qc.invalidateQueries({ queryKey: ["structure-months"] }); },
    onError: (e: any) => toast.error(e.message || "فشل التحديث"),
  });

  return (
    <div className="space-y-4">
      <Card className="card-soft">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileStack className="h-4 w-4" /> قوالب المهام
          </CardTitle>
          <NewTemplateDialog />
        </CardHeader>
        <CardContent>
          {isLoading && <div className="text-sm text-muted-foreground">جارٍ التحميل…</div>}
          {!isLoading && templates.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">لا توجد قوالب بعد.</div>
          )}
          <div className="space-y-2">
            {(templates as any[]).map((t) => (
              <div key={t.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{t.name}</div>
                      {t.is_system_default && <Badge className="bg-emerald-100 text-emerald-800">افتراضي النظام</Badge>}
                      <Badge variant="outline">{t.months_using} شهر يستخدمه</Badge>
                      {t.cloned_from_id && <Badge variant="outline"><Copy className="h-3 w-3 ml-1" /> مُستنسخ</Badge>}
                    </div>
                    {t.description && <div className="text-xs text-muted-foreground mt-1">{t.description}</div>}
                  </div>
                  <div className="flex gap-1">
                    <ColumnsEditorDialog template={t} />
                    <FieldsEditorDialog template={t} />
                    <StatusesEditorDialog template={t} />
                    <EditTemplateDialog template={t} />
                    <Button size="sm" variant="outline"
                      onClick={() => upd.mutate({ id: t.id, patch: { is_system_default: true } })}
                      disabled={t.is_system_default}>
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="text-red-600" disabled={t.is_system_default || t.months_using > 0}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف القالب "{t.name}"؟</AlertDialogTitle>
                          <AlertDialogDescription>هذا الإجراء لا يمكن التراجع عنه.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => del.mutate(t.id)}>حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground px-2">
        ملاحظة: يمكنك تخصيص الأعمدة والحقول الإضافية والحالات لكل قالب على حدة. التغييرات تُطبَّق على جميع الشهور التي تستخدم هذا القالب.
      </div>
    </div>
  );
}

function NewTemplateDialog() {
  const qc = useQueryClient();
  const createFn = useServerFn(createTemplate);
  const { data: templates = [] } = useTemplates();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cloneFrom, setCloneFrom] = useState<string>("__default__");
  const [makeDefault, setMakeDefault] = useState(false);

  const mut = useMutation({
    mutationFn: () => createFn({ data: {
      name: name.trim(),
      description: description.trim() || null,
      clone_from_id: cloneFrom === "__scratch__" ? null : (cloneFrom === "__default__" ? null : cloneFrom),
      is_system_default: makeDefault,
    } }),
    onSuccess: () => {
      toast.success("تم إنشاء القالب");
      qc.invalidateQueries({ queryKey: ["structure-templates"] });
      setOpen(false); setName(""); setDescription(""); setCloneFrom("__default__"); setMakeDefault(false);
    },
    onError: (e: any) => toast.error(e.message || "تعذّر الإنشاء"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 ml-1" /> قالب جديد</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إنشاء قالب جديد</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>الاسم *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: قالب أعمال أوفست" />
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>المصدر</Label>
            <Select value={cloneFrom} onValueChange={setCloneFrom}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__default__">نسخ من الافتراضي</SelectItem>
                <SelectItem value="__scratch__">قالب فارغ من الصفر</SelectItem>
                {(templates as any[]).map((t) => (
                  <SelectItem key={t.id} value={t.id}>نسخ من: {t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={makeDefault} onCheckedChange={(c) => setMakeDefault(!!c)} />
            <span>جعل هذا القالب افتراضيًا للنظام</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>إنشاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTemplateDialog({ template }: { template: any }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTemplate);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? "");

  const mut = useMutation({
    mutationFn: () => updFn({ data: { id: template.id, patch: {
      name: name.trim(), description: description.trim() || null,
    } } }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["structure-templates"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">تحرير</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تحرير القالب</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>الاسم</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>الوصف</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// COLUMNS EDITOR
// ============================================================

type ColumnDef = {
  key: string;
  label_ar: string;
  visible: boolean;
  order: number;
  width?: number;
  pinned?: boolean;
};

function ColumnsEditorDialog({ template }: { template: any }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTemplate);
  const [open, setOpen] = useState(false);
  const initial: ColumnDef[] = Array.isArray(template.columns_config) ? template.columns_config : [];
  const [cols, setCols] = useState<ColumnDef[]>(
    [...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  const mut = useMutation({
    mutationFn: () => updFn({ data: { id: template.id, patch: {
      columns_config: cols.map((c, i) => ({ ...c, order: i + 1 })),
    } } }),
    onSuccess: () => {
      toast.success("تم حفظ الأعمدة");
      qc.invalidateQueries({ queryKey: ["structure-templates"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  function toggle(i: number) {
    setCols((prev) => prev.map((c, idx) => idx === i ? { ...c, visible: !c.visible } : c));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    setCols((prev) => {
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }
  function setLabel(i: number, v: string) {
    setCols((prev) => prev.map((c, idx) => idx === i ? { ...c, label_ar: v } : c));
  }
  function setWidth(i: number, v: string) {
    const n = parseInt(v, 10);
    setCols((prev) => prev.map((c, idx) => idx === i ? { ...c, width: isNaN(n) ? undefined : n } : c));
  }
  function resetOpen(o: boolean) {
    setOpen(o);
    if (o) setCols([...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }

  const visibleCount = cols.filter((c) => c.visible).length;

  return (
    <Dialog open={open} onOpenChange={resetOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Columns3 className="h-3.5 w-3.5 ml-1" /> الأعمدة</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إدارة أعمدة القالب — {template.name}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground pb-2">
          {visibleCount} عمود ظاهر من أصل {cols.length}. استخدم الأسهم لإعادة الترتيب.
        </div>
        {cols.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            لا توجد أعمدة معرّفة. سيتم تطبيق الأعمدة الافتراضية تلقائيًا عند الحفظ لأول مرة.
          </div>
        ) : (
          <div className="space-y-1.5">
            {cols.map((c, i) => (
              <div key={c.key} className={`flex items-center gap-2 border rounded-md p-2 ${c.visible ? "" : "opacity-60"}`}>
                <div className="flex flex-col gap-0.5">
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, 1)} disabled={i === cols.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="text-xs font-mono text-muted-foreground w-24 truncate" title={c.key}>{c.key}</div>
                <Input
                  value={c.label_ar}
                  onChange={(e) => setLabel(i, e.target.value)}
                  className="h-8 flex-1"
                  placeholder="اسم العمود بالعربية"
                />
                <Input
                  type="number"
                  value={c.width ?? ""}
                  onChange={(e) => setWidth(i, e.target.value)}
                  className="h-8 w-20"
                  placeholder="عرض"
                />
                <Button
                  size="sm"
                  variant={c.visible ? "default" : "outline"}
                  className="h-8"
                  onClick={() => toggle(i)}
                >
                  {c.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>حفظ التغييرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// PHASE 4 — CUSTOM FIELDS EDITOR
// ============================================================

type FieldType = "text" | "textarea" | "number" | "date" | "select" | "checkbox" | "url";
type FieldDef = {
  key: string;
  label_ar: string;
  type: FieldType;
  required?: boolean;
  visible?: boolean;
  order?: number;
  options?: string[]; // for select
  placeholder?: string;
  help?: string;
};

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "نص قصير",
  textarea: "نص طويل",
  number: "رقم",
  date: "تاريخ",
  select: "قائمة اختيار",
  checkbox: "مربع اختيار",
  url: "رابط",
};

function slugifyKey(v: string) {
  const base = v.trim().toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || `field_${Math.random().toString(36).slice(2, 7)}`;
}

function FieldsEditorDialog({ template }: { template: any }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTemplate);
  const [open, setOpen] = useState(false);
  const initial: FieldDef[] = Array.isArray(template.fields_config) ? template.fields_config : [];
  const [fields, setFields] = useState<FieldDef[]>(
    [...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  const mut = useMutation({
    mutationFn: () => updFn({ data: { id: template.id, patch: {
      fields_config: fields.map((f, i) => ({ ...f, order: i + 1 })),
    } } }),
    onSuccess: () => {
      toast.success("تم حفظ الحقول");
      qc.invalidateQueries({ queryKey: ["structure-templates"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  function addField() {
    const idx = fields.length + 1;
    setFields((p) => [...p, {
      key: `custom_${idx}`,
      label_ar: `حقل ${idx}`,
      type: "text",
      required: false,
      visible: true,
      order: idx,
    }]);
  }
  function updateField(i: number, patch: Partial<FieldDef>) {
    setFields((p) => p.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }
  function removeField(i: number) {
    setFields((p) => p.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    setFields((p) => {
      const arr = [...p];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }
  function resetOpen(o: boolean) {
    setOpen(o);
    if (o) setFields([...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }

  const dupKey = (() => {
    const seen = new Set<string>();
    for (const f of fields) {
      const k = (f.key || "").trim();
      if (!k) return "empty";
      if (seen.has(k)) return k;
      seen.add(k);
    }
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={resetOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><ListPlus className="h-3.5 w-3.5 ml-1" /> الحقول</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>الحقول الإضافية — {template.name}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground pb-2">
          الحقول الإضافية تُخزَّن كبيانات مرنة للتاسك وتظهر في نموذج التاسك عند تطبيق القالب.
        </div>
        {fields.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            لا توجد حقول إضافية. اضغط "إضافة حقل".
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={i} className={`border rounded-md p-3 space-y-2 ${f.visible === false ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, 1)} disabled={i === fields.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={f.label_ar}
                    onChange={(e) => updateField(i, { label_ar: e.target.value })}
                    onBlur={(e) => { if (!f.key || f.key.startsWith("custom_")) updateField(i, { key: slugifyKey(e.target.value) }); }}
                    className="h-8 flex-1"
                    placeholder="اسم الحقل بالعربية"
                  />
                  <Select value={f.type} onValueChange={(v: FieldType) => updateField(i, { type: v })}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant={f.visible === false ? "outline" : "default"} className="h-8"
                    onClick={() => updateField(i, { visible: !(f.visible !== false) })}>
                    {f.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={() => removeField(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 pr-8">
                  <div>
                    <Label className="text-xs">المفتاح (مرجع فني)</Label>
                    <Input value={f.key} onChange={(e) => updateField(i, { key: slugifyKey(e.target.value) })}
                      className="h-8 font-mono text-xs" />
                  </div>
                  <label className="flex items-center gap-2 text-sm mt-6">
                    <Checkbox checked={!!f.required} onCheckedChange={(c) => updateField(i, { required: !!c })} />
                    <span>مطلوب</span>
                  </label>
                </div>
                {f.type === "select" && (
                  <div className="pr-8">
                    <Label className="text-xs">الخيارات (سطر لكل خيار)</Label>
                    <Textarea
                      rows={3}
                      value={(f.options ?? []).join("\n")}
                      onChange={(e) => updateField(i, {
                        options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                      })}
                      placeholder="خيار 1&#10;خيار 2"
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center pt-2">
          <Button size="sm" variant="outline" onClick={addField}>
            <Plus className="h-3.5 w-3.5 ml-1" /> إضافة حقل
          </Button>
          {dupKey && <span className="text-xs text-red-600">مفتاح مكرر أو فارغ: {dupKey}</span>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !!dupKey}>حفظ التغييرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// PHASE 5 — STATUSES EDITOR
// ============================================================

type StatusDef = {
  key: string;
  label_ar: string;
  color?: string; // hex or tailwind token
  order?: number;
  is_terminal?: boolean;
  requires_reason?: boolean;
};

const STATUS_COLOR_PRESETS = [
  { label: "رمادي", value: "#94a3b8" },
  { label: "أزرق", value: "#3b82f6" },
  { label: "بنفسجي", value: "#8b5cf6" },
  { label: "أخضر", value: "#10b981" },
  { label: "أصفر", value: "#f59e0b" },
  { label: "أحمر", value: "#ef4444" },
];

function StatusesEditorDialog({ template }: { template: any }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTemplate);
  const [open, setOpen] = useState(false);
  const initial: StatusDef[] = Array.isArray(template.statuses_config) ? template.statuses_config : [];
  const [statuses, setStatuses] = useState<StatusDef[]>(
    [...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  const mut = useMutation({
    mutationFn: () => updFn({ data: { id: template.id, patch: {
      statuses_config: statuses.map((s, i) => ({ ...s, order: i + 1 })),
    } } }),
    onSuccess: () => {
      toast.success("تم حفظ الحالات");
      qc.invalidateQueries({ queryKey: ["structure-templates"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  function addStatus() {
    const idx = statuses.length + 1;
    setStatuses((p) => [...p, {
      key: `status_${idx}`,
      label_ar: `حالة ${idx}`,
      color: "#94a3b8",
      order: idx,
    }]);
  }
  function updateStatus(i: number, patch: Partial<StatusDef>) {
    setStatuses((p) => p.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function removeStatus(i: number) {
    setStatuses((p) => p.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= statuses.length) return;
    setStatuses((p) => {
      const arr = [...p];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }
  function resetOpen(o: boolean) {
    setOpen(o);
    if (o) setStatuses([...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }

  const dupKey = (() => {
    const seen = new Set<string>();
    for (const s of statuses) {
      const k = (s.key || "").trim();
      if (!k) return "empty";
      if (seen.has(k)) return k;
      seen.add(k);
    }
    return null;
  })();

  return (
    <Dialog open={open} onOpenChange={resetOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Flag className="h-3.5 w-3.5 ml-1" /> الحالات</Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>حالات القالب — {template.name}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground pb-2">
          هذه الحالات تظهر داخل التاسكات المرتبطة بالقالب. اجعل الحالة "نهائية" عندما لا يجب الخروج منها إلا بصلاحية إدارية.
        </div>
        {statuses.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            لا توجد حالات مخصّصة. اضغط "إضافة حالة".
          </div>
        ) : (
          <div className="space-y-2">
            {statuses.map((s, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, 1)} disabled={i === statuses.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="h-6 w-6 rounded-full border" style={{ background: s.color ?? "#94a3b8" }} />
                  <Input
                    value={s.label_ar}
                    onChange={(e) => updateStatus(i, { label_ar: e.target.value })}
                    onBlur={(e) => { if (!s.key || s.key.startsWith("status_")) updateStatus(i, { key: slugifyKey(e.target.value) }); }}
                    className="h-8 flex-1"
                    placeholder="اسم الحالة"
                  />
                  <Select value={s.color ?? "#94a3b8"} onValueChange={(v) => updateStatus(i, { color: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_COLOR_PRESETS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full inline-block" style={{ background: p.value }} />
                            {p.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={() => removeStatus(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 pr-8 items-center">
                  <div>
                    <Label className="text-xs">المفتاح</Label>
                    <Input value={s.key} onChange={(e) => updateStatus(i, { key: slugifyKey(e.target.value) })}
                      className="h-8 font-mono text-xs" />
                  </div>
                  <label className="flex items-center gap-2 text-sm mt-5">
                    <Checkbox checked={!!s.is_terminal} onCheckedChange={(c) => updateStatus(i, { is_terminal: !!c })} />
                    <span>حالة نهائية</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm mt-5">
                    <Checkbox checked={!!s.requires_reason} onCheckedChange={(c) => updateStatus(i, { requires_reason: !!c })} />
                    <span>تتطلب سببًا</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between items-center pt-2">
          <Button size="sm" variant="outline" onClick={addStatus}>
            <Plus className="h-3.5 w-3.5 ml-1" /> إضافة حالة
          </Button>
          {dupKey && <span className="text-xs text-red-600">مفتاح مكرر أو فارغ: {dupKey}</span>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !!dupKey}>حفظ التغييرات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DEPARTMENTS PANEL (Phase 1)
// ============================================================
import {
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  listDepartmentMembers, addDepartmentMember, updateDepartmentMember, removeDepartmentMember,
  listAssignableUsers, listTaskTypes, createTaskType, updateTaskType, deleteTaskType,
  getDepartmentCapabilities, getDepartmentTemplate,
} from "@/lib/departments.functions";
import { Building2, Users, Search, Palette, ClipboardList } from "lucide-react";

const DEPT_ROLE_LABEL: Record<string,string> = {
  department_manager:    "مدير قسم",
  department_supervisor: "مشرف قسم",
  team_leader:           "قائد فريق",
  employee:              "موظف",
  viewer:                "مشاهد فقط",
};

function DepartmentsPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDepartments);
  const capsFn = useServerFn(getDepartmentCapabilities);
  const { data: caps } = useQuery({ queryKey: ["dept-caps"], queryFn: () => capsFn() });
  const { data: depts = [] } = useQuery({ queryKey: ["departments"], queryFn: () => listFn() });
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [openMembers, setOpenMembers] = useState<string | null>(null);
  const [openEdit, setOpenEdit] = useState<any | null>(null);

  const canManage = caps?.manage_departments === true;

  const filtered = (depts as any[]).filter((d: any) => {
    if (!showArchived && d.is_archived) return false;
    if (search.trim() === "") return true;
    const s = search.trim().toLowerCase();
    return d.name_ar.toLowerCase().includes(s) ||
           (d.name_en ?? "").toLowerCase().includes(s) ||
           d.key.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
                 placeholder="بحث عن قسم…" className="pr-8" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showArchived} onCheckedChange={(v) => setShowArchived(v === true)} />
          إظهار المؤرشفة
        </label>
        {canManage && <NewDepartmentDialog />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            لا توجد أقسام مطابقة.
          </div>
        )}
        {filtered.map((d: any) => (
          <Card key={d.id} className="card-soft">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold"
                       style={{ backgroundColor: d.color }}>
                    {d.name_ar.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold">{d.name_ar}</div>
                    <div className="text-xs text-muted-foreground">
                      {d.name_en || d.key} · <code className="font-mono">{d.key}</code>
                    </div>
                  </div>
                </div>
                {d.is_archived && <Badge variant="secondary">مؤرشف</Badge>}
              </div>

              {d.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{d.description}</p>
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline"><Users className="h-3 w-3 ml-1" />{d.members_count} عضو</Badge>
                <Badge variant="outline"><ClipboardList className="h-3 w-3 ml-1" />{d.tasks_count} تاسك</Badge>
                <Badge variant="outline">ترتيب: {d.sort_order}</Badge>
              </div>

              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => setOpenMembers(d.id)}>
                  <Users className="h-3.5 w-3.5 ml-1" /> الأعضاء
                </Button>
                {canManage && <DepartmentStatusesButton dept={d} />}
                {canManage && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setOpenEdit(d)}>تعديل</Button>
                    <ArchiveDeptButton dept={d} />
                    <DeleteDeptButton dept={d} />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {openMembers && (
        <DepartmentMembersDialog
          departmentId={openMembers}
          department={(depts as any[]).find((x: any) => x.id === openMembers)}
          onClose={() => setOpenMembers(null)}
          canManage={caps?.manage_department_members === true}
        />
      )}
      {openEdit && (
        <EditDepartmentDialog
          dept={openEdit}
          onClose={() => setOpenEdit(null)}
        />
      )}
    </div>
  );
}

function NewDepartmentDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    key: "", name_ar: "", name_en: "", color: "#E30613",
    icon: "Building2", description: "", sort_order: 100,
  });
  const createFn = useServerFn(createDepartment);
  const mut = useMutation({
    mutationFn: async () => createFn({ data: form as any }),
    onSuccess: () => {
      toast.success("تم إنشاء القسم");
      qc.invalidateQueries({ queryKey: ["departments"] });
      setOpen(false);
      setForm({ key: "", name_ar: "", name_en: "", color: "#E30613", icon: "Building2", description: "", sort_order: 100 });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الإنشاء"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 ml-1" /> قسم جديد</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>إنشاء قسم جديد</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الاسم بالعربية *</Label>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </div>
          <div>
            <Label>الاسم بالإنجليزية</Label>
            <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </div>
          <div>
            <Label>المفتاح الفني *</Label>
            <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })}
                   placeholder="marketing" className="font-mono" />
            <p className="text-xs text-muted-foreground mt-1">حروف إنجليزية صغيرة وأرقام و _ فقط.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>اللون</Label>
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <Label>الترتيب</Label>
              <Input type="number" value={form.sort_order}
                     onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>وصف مختصر</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.name_ar || !form.key}>
            إنشاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDepartmentDialog({ dept, onClose }: { dept: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name_ar: dept.name_ar, name_en: dept.name_en ?? "",
    color: dept.color, icon: dept.icon,
    description: dept.description ?? "", sort_order: dept.sort_order,
  });
  const updateFn = useServerFn(updateDepartment);
  const mut = useMutation({
    mutationFn: async () => updateFn({ data: { id: dept.id, patch: form } as any }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["departments"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل الحفظ"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تعديل القسم — {dept.name_ar}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>الاسم بالعربية</Label>
            <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </div>
          <div>
            <Label>الاسم بالإنجليزية</Label>
            <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>اللون</Label>
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <Label>الترتيب</Label>
              <Input type="number" value={form.sort_order}
                     onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label>وصف مختصر</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <p className="text-xs text-muted-foreground">المفتاح الفني <code>{dept.key}</code> لا يمكن تغييره.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentStatusesButton({ dept }: { dept: any }) {
  const tplFn = useServerFn(getDepartmentTemplate);
  const [open, setOpen] = useState(false);
  const { data: tpl, isFetching } = useQuery({
    queryKey: ["dept-template", dept.id, open],
    queryFn: () => tplFn({ data: { department_id: dept.id } }),
    enabled: open,
    staleTime: 0,
  });
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Flag className="h-3.5 w-3.5 ml-1" /> الحالات
      </Button>
      {open && (
        isFetching || !tpl ? (
          <Dialog open onOpenChange={(v) => !v && setOpen(false)}>
            <DialogContent dir="rtl" className="max-w-sm">
              <DialogHeader><DialogTitle>حالات {dept.name_ar}</DialogTitle></DialogHeader>
              <div className="text-sm text-muted-foreground py-4 text-center">
                {isFetching ? "جارٍ التحميل…" : "لا يوجد قالب افتراضي لهذا القسم."}
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <DepartmentStatusesInlineDialog template={tpl} onClose={() => setOpen(false)} />
        )
      )}
    </>
  );
}

// Same editor as StatusesEditorDialog but opened programmatically (no trigger button).
function DepartmentStatusesInlineDialog({ template, onClose }: { template: any; onClose: () => void }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTemplate);
  const initial: StatusDef[] = Array.isArray(template.statuses_config) ? template.statuses_config : [];
  const [statuses, setStatuses] = useState<StatusDef[]>(
    [...initial].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const mut = useMutation({
    mutationFn: () => updFn({ data: { id: template.id, patch: {
      statuses_config: statuses.map((s, i) => ({ ...s, order: i + 1 })),
    } } }),
    onSuccess: () => {
      toast.success("تم حفظ حالات القسم");
      qc.invalidateQueries({ queryKey: ["structure-templates"] });
      qc.invalidateQueries({ queryKey: ["dept-template"] });
      qc.invalidateQueries({ queryKey: ["task-statuses"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });
  const addStatus = () => {
    const idx = statuses.length + 1;
    setStatuses((p) => [...p, { key: `status_${idx}`, label_ar: `حالة ${idx}`, color: "#94a3b8", order: idx }]);
  };
  const updateStatus = (i: number, patch: Partial<StatusDef>) =>
    setStatuses((p) => p.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  const removeStatus = (i: number) => setStatuses((p) => p.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= statuses.length) return;
    setStatuses((p) => { const arr = [...p]; [arr[i], arr[j]] = [arr[j], arr[i]]; return arr; });
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>حالات القسم — {template.name}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground pb-2">
          هذه الحالات تظهر في كل تاسك مرتبط بهذا القسم. يمكنك إضافة أي عدد يناسب طبيعة عمل القسم.
        </div>
        {statuses.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-6">
            لا توجد حالات بعد. اضغط "إضافة حالة".
          </div>
        ) : (
          <div className="space-y-2">
            {statuses.map((s, i) => (
              <div key={i} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => move(i, 1)} disabled={i === statuses.length - 1}>
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="h-6 w-6 rounded-full border" style={{ background: s.color ?? "#94a3b8" }} />
                  <Input
                    value={s.label_ar}
                    onChange={(e) => updateStatus(i, { label_ar: e.target.value })}
                    onBlur={(e) => { if (!s.key || s.key.startsWith("status_")) updateStatus(i, { key: slugifyKey(e.target.value) }); }}
                    className="h-8 flex-1" placeholder="اسم الحالة"
                  />
                  <Input type="color" className="h-8 w-14 p-1" value={s.color ?? "#94a3b8"}
                         onChange={(e) => updateStatus(i, { color: e.target.value })} />
                  <Button size="sm" variant="ghost" className="h-8 text-red-600" onClick={() => removeStatus(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 pr-8 items-center">
                  <div>
                    <Label className="text-xs">المفتاح</Label>
                    <Input value={s.key} onChange={(e) => updateStatus(i, { key: slugifyKey(e.target.value) })}
                      className="h-8 font-mono text-xs" />
                  </div>
                  <label className="flex items-center gap-2 text-xs mt-4">
                    <Checkbox checked={!!s.is_terminal} onCheckedChange={(v) => updateStatus(i, { is_terminal: v === true })} />
                    حالة نهائية
                  </label>
                  <label className="flex items-center gap-2 text-xs mt-4">
                    <Checkbox checked={!!s.requires_reason} onCheckedChange={(v) => updateStatus(i, { requires_reason: v === true })} />
                    تتطلب سببًا
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={addStatus}><Plus className="h-4 w-4 ml-1" />إضافة حالة</Button>
          <div className="flex-1" />
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>حفظ الحالات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDeptButton({ dept }: { dept: any }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateDepartment);
  const mut = useMutation({
    mutationFn: async () => updateFn({ data: { id: dept.id, patch: { is_archived: !dept.is_archived } } as any }),
    onSuccess: () => {
      toast.success(dept.is_archived ? "تم استرجاع القسم" : "تم أرشفة القسم");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });
  return (
    <Button size="sm" variant="outline" onClick={() => mut.mutate()} disabled={mut.isPending}>
      {dept.is_archived ? <><ArchiveRestore className="h-3.5 w-3.5 ml-1" />استرجاع</>
                        : <><Archive className="h-3.5 w-3.5 ml-1" />أرشفة</>}
    </Button>
  );
}

function DeleteDeptButton({ dept }: { dept: any }) {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteDepartment);
  const mut = useMutation({
    mutationFn: async () => delFn({ data: { id: dept.id } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "لا يمكن الحذف"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 ml-1" />حذف
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>حذف القسم "{dept.name_ar}"؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيفشل الحذف إن كان القسم يحتوي على أعضاء أو تاسكات. يمكنك أرشفته بدلًا من ذلك.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={() => mut.mutate()}>حذف</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DepartmentMembersDialog({
  departmentId, department, onClose, canManage,
}: { departmentId: string; department: any; onClose: () => void; canManage: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDepartmentMembers);
  const usersFn = useServerFn(listAssignableUsers);
  const addFn = useServerFn(addDepartmentMember);
  const updFn = useServerFn(updateDepartmentMember);
  const rmFn  = useServerFn(removeDepartmentMember);

  const { data: members = [] } = useQuery({
    queryKey: ["dept-members", departmentId],
    queryFn: () => listFn({ data: { department_id: departmentId } }),
  });
  const { data: users = [] } = useQuery({
    queryKey: ["assignable-users"], queryFn: () => usersFn(),
    enabled: canManage,
  });

  const memberUserIds = new Set((members as any[]).map((m: any) => m.user_id));
  const [pickUser, setPickUser] = useState("");
  const [pickRole, setPickRole] = useState<string>("employee");

  const addMut = useMutation({
    mutationFn: async () => addFn({ data: { department_id: departmentId, user_id: pickUser, role: pickRole as any, is_primary: false } as any }),
    onSuccess: () => {
      toast.success("تمت الإضافة");
      qc.invalidateQueries({ queryKey: ["dept-members", departmentId] });
      qc.invalidateQueries({ queryKey: ["departments"] });
      setPickUser("");
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  const updMut = useMutation({
    mutationFn: async ({ id, patch }: any) => updFn({ data: { id, patch } as any }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["dept-members", departmentId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  const rmMut = useMutation({
    mutationFn: async (id: string) => rmFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["dept-members", departmentId] });
      qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>أعضاء قسم "{department?.name_ar}"</DialogTitle>
        </DialogHeader>

        {canManage && (
          <div className="flex flex-wrap gap-2 items-end p-3 bg-muted/40 rounded-md">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">المستخدم</Label>
              <Select value={pickUser} onValueChange={setPickUser}>
                <SelectTrigger><SelectValue placeholder="اختر مستخدم…" /></SelectTrigger>
                <SelectContent>
                  {(users as any[]).filter((u: any) => !memberUserIds.has(u.id)).map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name} — {u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs">الدور</Label>
              <Select value={pickRole} onValueChange={setPickRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DEPT_ROLE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => addMut.mutate()} disabled={!pickUser || addMut.isPending}>
              <Plus className="h-4 w-4 ml-1" /> إضافة
            </Button>
          </div>
        )}

        <div className="space-y-2 max-h-[400px] overflow-auto">
          {(members as any[]).length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">لا يوجد أعضاء بعد.</div>
          )}
          {(members as any[]).map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <div className="font-medium">{m.profiles?.full_name ?? "—"}</div>
                <div className="text-xs text-muted-foreground">{m.profiles?.email}</div>
              </div>
              <div className="flex items-center gap-2">
                {canManage ? (
                  <Select value={m.role}
                          onValueChange={(v) => updMut.mutate({ id: m.id, patch: { role: v } })}>
                    <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DEPT_ROLE_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary">{DEPT_ROLE_LABEL[m.role] ?? m.role}</Badge>
                )}
                {!m.active && <Badge variant="outline">غير نشط</Badge>}
                {canManage && (
                  <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => rmMut.mutate(m.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إغلاق</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// TASK TYPES PANEL (Phase 1)
// ============================================================
function TaskTypesPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTaskTypes);
  const deptFn = useServerFn(listDepartments);
  const capsFn = useServerFn(getDepartmentCapabilities);
  const { data: caps } = useQuery({ queryKey: ["dept-caps"], queryFn: () => capsFn() });
  const { data: types = [] } = useQuery({ queryKey: ["task-types"], queryFn: () => listFn() });
  const { data: depts = [] } = useQuery({ queryKey: ["departments"], queryFn: () => deptFn() });
  const [openEdit, setOpenEdit] = useState<any | null>(null);
  const canManage = caps?.manage_task_types === true;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">أنواع المهام</h3>
        {canManage && <NewTaskTypeDialog depts={depts as any[]} />}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(types as any[]).length === 0 && (
          <div className="col-span-full text-center py-10 text-muted-foreground">
            لا توجد أنواع مهام بعد.
          </div>
        )}
        {(types as any[]).map((t: any) => (
          <Card key={t.id} className="card-soft">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded flex items-center justify-center text-white"
                       style={{ backgroundColor: t.color }}>
                    <ClipboardList className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold">{t.name_ar}</div>
                    <div className="text-xs text-muted-foreground font-mono">{t.key}</div>
                  </div>
                </div>
                {t.is_archived && <Badge variant="secondary">مؤرشف</Badge>}
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                {t.departments && (
                  <Badge variant="outline" style={{ borderColor: t.departments.color }}>
                    {t.departments.name_ar}
                  </Badge>
                )}
                {t.code_prefix && <Badge variant="outline">{t.code_prefix}</Badge>}
                <Badge variant="outline">{t.default_priority}</Badge>
                {t.default_sla_hours && <Badge variant="outline">SLA {t.default_sla_hours}س</Badge>}
              </div>
              {canManage && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => setOpenEdit(t)}>تعديل</Button>
                  <DeleteTaskTypeButton tt={t} />
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {openEdit && (
        <EditTaskTypeDialog tt={openEdit} depts={depts as any[]} onClose={() => setOpenEdit(null)} />
      )}
    </div>
  );
}

function taskTypeForm(defaults: any = {}) {
  return {
    key: "", name_ar: "", name_en: "", color: "#FF5A2C", icon: "ClipboardList",
    description: "", department_id: null as string | null, code_prefix: "",
    default_priority: "عادية", default_sla_hours: null as number | null,
    sort_order: 100, ...defaults,
  };
}

function TaskTypeFormFields({ form, setForm, depts }: any) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>الاسم بالعربية *</Label>
          <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
        </div>
        <div>
          <Label>الاسم بالإنجليزية</Label>
          <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المفتاح *</Label>
          <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value.toLowerCase() })}
                 className="font-mono" placeholder="content_plan" />
        </div>
        <div>
          <Label>كود التاسك (Prefix)</Label>
          <Input value={form.code_prefix ?? ""}
                 onChange={(e) => setForm({ ...form, code_prefix: e.target.value.toUpperCase() })}
                 className="font-mono" placeholder="MKT" />
        </div>
      </div>
      <div>
        <Label>القسم</Label>
        <Select value={form.department_id ?? "__none"}
                onValueChange={(v) => setForm({ ...form, department_id: v === "__none" ? null : v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">عام (كل الأقسام)</SelectItem>
            {(depts as any[]).map((d: any) => (
              <SelectItem key={d.id} value={d.id}>{d.name_ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>اللون</Label>
          <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        </div>
        <div>
          <Label>الأولوية</Label>
          <Select value={form.default_priority}
                  onValueChange={(v) => setForm({ ...form, default_priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["عاجل","عالية","متوسطة","عادية"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>SLA (ساعات)</Label>
          <Input type="number" value={form.default_sla_hours ?? ""}
                 onChange={(e) => setForm({ ...form, default_sla_hours: e.target.value ? Number(e.target.value) : null })} />
        </div>
      </div>
      <div>
        <Label>وصف مختصر</Label>
        <Textarea value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
    </div>
  );
}

function NewTaskTypeDialog({ depts }: { depts: any[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(taskTypeForm());
  const createFn = useServerFn(createTaskType);
  const mut = useMutation({
    mutationFn: async () => createFn({ data: form as any }),
    onSuccess: () => {
      toast.success("تم الإنشاء");
      qc.invalidateQueries({ queryKey: ["task-types"] });
      setOpen(false); setForm(taskTypeForm());
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 ml-1" />نوع مهمة جديد</Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>نوع مهمة جديد</DialogTitle></DialogHeader>
        <TaskTypeFormFields form={form} setForm={setForm} depts={depts} />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={!form.name_ar || !form.key || mut.isPending}>إنشاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditTaskTypeDialog({ tt, depts, onClose }: { tt: any; depts: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(taskTypeForm(tt));
  const updateFn = useServerFn(updateTaskType);
  const mut = useMutation({
    mutationFn: async () => updateFn({ data: { id: tt.id, patch: form } as any }),
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["task-types"] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message ?? "فشل"),
  });
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>تعديل — {tt.name_ar}</DialogTitle></DialogHeader>
        <TaskTypeFormFields form={form} setForm={setForm} depts={depts} />
        <div className="flex items-center gap-2 pt-2">
          <Checkbox checked={form.is_archived === true}
                    onCheckedChange={(v) => setForm({ ...form, is_archived: v === true })} />
          <Label>مؤرشف</Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTaskTypeButton({ tt }: { tt: any }) {
  const qc = useQueryClient();
  const delFn = useServerFn(deleteTaskType);
  const mut = useMutation({
    mutationFn: async () => delFn({ data: { id: tt.id } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["task-types"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "لا يمكن الحذف"),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 ml-1" />حذف
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>حذف "{tt.name_ar}"؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيفشل الحذف إن كان النوع مستخدمًا في تاسكات. أرشفه بدلًا من ذلك.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={() => mut.mutate()}>حذف</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
