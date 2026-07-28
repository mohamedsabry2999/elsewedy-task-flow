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
        <h1 className="text-2xl font-bold">إدارة السنوات والشهور والقوالب</h1>
        <p className="text-sm text-muted-foreground">إدارة هيكل النظام وقوالب المهام لكل شهر.</p>
      </div>
      <Tabs defaultValue="years" dir="rtl">
        <TabsList>
          <TabsTrigger value="years">السنوات والشهور</TabsTrigger>
          <TabsTrigger value="templates">القوالب</TabsTrigger>
          <TabsTrigger value="audit">سجل تعديلات الهيكل</TabsTrigger>
        </TabsList>
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
