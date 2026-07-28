import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTasks, updateTask, archiveTask, softDeleteTask, listProfiles } from "@/lib/tasks.functions";
import {
  OVERALL_STATUS, DESIGN_STATUS, PRIORITY, CUSTOMER_TYPE, PRODUCT_SERVICE,
  STATUS_COLOR, PRIORITY_COLOR, MONTHS,
} from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatDate, formatDueDateTime, toCSV, downloadCSV, isOverdue } from "@/lib/format";
import { Archive, ArchiveRestore, Columns, Download, Filter, Search, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";

type Task = any;

const ALL_COLUMNS: { key: string; label: string; group?: string }[] = [
  { key: "task_name", label: "اسم التاسك", group: "أساسي" },
  { key: "task_code", label: "Task ID", group: "أساسي" },
  { key: "overall_status", label: "الحالة العامة", group: "أساسي" },
  { key: "customer_name", label: "العميل", group: "سيلز" },
  { key: "sales_owner_name", label: "مسؤول السيلز", group: "سيلز" },
  { key: "customer_type", label: "نوع العميل", group: "سيلز" },
  { key: "products", label: "المنتج/الخدمة", group: "سيلز" },
  { key: "order_details", label: "تفاصيل الطلب", group: "سيلز" },
  { key: "size_qty_material", label: "المقاس/الكمية/الخامة", group: "سيلز" },
  { key: "design_brief", label: "المطلوب من التصميم", group: "سيلز" },
  { key: "priority", label: "الأولوية", group: "سيلز" },
  { key: "request_date", label: "تاريخ إرسال الطلب", group: "سيلز" },
  { key: "designer_name", label: "مسؤول التصميم", group: "تصميم" },
  { key: "design_status", label: "حالة التصميم", group: "تصميم" },
  { key: "design_start_date", label: "تاريخ بدء التصميم", group: "تصميم" },
  { key: "delivery_due_date", label: "موعد التسليم", group: "تصميم" },
  { key: "files_url", label: "رابط الملفات", group: "تصميم" },
  { key: "designer_notes", label: "ملاحظات المصمم", group: "تصميم" },
  { key: "sales_client_revisions", label: "تعديلات السيلز/العميل", group: "تصميم" },
  { key: "final_version_url", label: "النسخة النهائية", group: "تصميم" },
  { key: "actual_delivery_date", label: "تاريخ التسليم الفعلي", group: "تصميم" },
  { key: "delivered", label: "تم التسليم", group: "تصميم" },
];

const DEFAULT_VISIBLE = ALL_COLUMNS.map((c) => c.key);

type View = "table" | "kanban" | "mine" | "delayed" | "completed";

export function TasksExplorer({ monthCode, currentUserId }: { monthCode?: string; currentUserId?: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTasks);
  const updateFn = useServerFn(updateTask);
  const archiveFn = useServerFn(archiveTask);
  const deleteFn = useServerFn(softDeleteTask);
  const profilesFn = useServerFn(listProfiles);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", monthCode ?? "all"],
    queryFn: () => listFn({ data: { month: monthCode, includeArchived: false } }),
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles-lite"], queryFn: () => profilesFn() });
  const nameById = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name || p.email])), [profiles]);

  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("table");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [designStatusFilter, setDesignStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_VISIBLE);
  const [sortKey, setSortKey] = useState<string>("created_at");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const enriched = useMemo(() => (tasks as Task[]).map((t) => ({
    ...t,
    sales_owner_name: t.sales_owner_id ? nameById.get(t.sales_owner_id) ?? "—" : "—",
    designer_name: t.designer_id ? nameById.get(t.designer_id) ?? "—" : "—",
    overdue: isOverdue(t.delivery_due_date, t.delivered),
  })), [tasks, nameById]);

  const filtered = useMemo(() => {
    let rows = enriched;
    if (view === "mine" && currentUserId) rows = rows.filter((r) => r.sales_owner_id === currentUserId || r.designer_id === currentUserId);
    if (view === "delayed") rows = rows.filter((r) => r.overdue);
    if (view === "completed") rows = rows.filter((r) => r.overall_status === "مكتمل");
    if (statusFilter !== "all") rows = rows.filter((r) => r.overall_status === statusFilter);
    if (priorityFilter !== "all") rows = rows.filter((r) => r.priority === priorityFilter);
    if (designStatusFilter !== "all") rows = rows.filter((r) => r.design_status === designStatusFilter);
    if (productFilter !== "all") rows = rows.filter((r) => (r.products || []).includes(productFilter));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => [r.task_name, r.task_code, r.customer_name, r.order_details].some((v) => (v ?? "").toString().toLowerCase().includes(q)));
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null) return 1; if (bv == null) return -1;
      return (av > bv ? 1 : av < bv ? -1 : 0) * (sortDesc ? -1 : 1);
    });
    return rows;
  }, [enriched, view, currentUserId, statusFilter, priorityFilter, designStatusFilter, productFilter, search, sortKey, sortDesc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const update = useMutation({
    mutationFn: (v: { id: string; patch: Record<string, unknown> }) => updateFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["dashboard-stats"] }); },
    onError: (e: any) => toast.error(e.message || "فشل التحديث"),
  });

  const doArchive = useMutation({
    mutationFn: (v: { id: string; archived: boolean }) => archiveFn({ data: v }),
    onSuccess: () => { toast.success("تمت الأرشفة"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
  });

  const doDelete = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["tasks"] }); },
    onError: (e: any) => toast.error(e.message || "فشل الحذف"),
  });

  const exportCSV = () => {
    const headers = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key));
    const rows = filtered.map((r) => Object.fromEntries(headers.map((h) => [h.key, formatCell(r, h.key)])));
    downloadCSV(`elsewedy-tasks-${monthCode ?? "all"}-${Date.now()}.csv`, toCSV(rows, headers));
    toast.success("تم تصدير الملف");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="ابحث بالاسم، الكود، العميل..." className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <Select value={view} onValueChange={(v) => setView(v as View)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="table">جدول</SelectItem>
            <SelectItem value="kanban">كانبان</SelectItem>
            <SelectItem value="mine">مهامي</SelectItem>
            <SelectItem value="delayed">متأخرة</SelectItem>
            <SelectItem value="completed">مكتملة</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            {OVERALL_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="الأولوية" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأولويات</SelectItem>
            {PRIORITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={designStatusFilter} onValueChange={setDesignStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="حالة التصميم" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل حالات التصميم</SelectItem>
            {DESIGN_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="المنتج" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المنتجات</SelectItem>
            {PRODUCT_SERVICE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1"><Columns className="h-4 w-4" /> الأعمدة</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-96 overflow-auto">
            <DropdownMenuLabel>إظهار/إخفاء الأعمدة</DropdownMenuLabel>
            {ALL_COLUMNS.map((c) => (
              <DropdownMenuCheckboxItem key={c.key} checked={visibleCols.includes(c.key)}
                onCheckedChange={(checked) => setVisibleCols((cur) => checked ? [...cur, c.key] : cur.filter((k) => k !== c.key))}>
                {c.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1"><Download className="h-4 w-4" /> CSV</Button>
      </div>

      <div className="text-sm text-muted-foreground">
        {isLoading ? "جارٍ التحميل…" : `عرض ${filtered.length} تاسك${filtered.length === 1 ? "" : ""}`}
      </div>

      {view === "kanban" ? (
        <KanbanBoard rows={filtered} onUpdate={(id, patch) => update.mutate({ id, patch })} onOpen={setSelectedTaskId} />
      ) : (
        <div className="rounded-lg border bg-background overflow-auto card-soft">
          <Table>
            <TableHeader>
              <TableRow>
                {ALL_COLUMNS.filter((c) => visibleCols.includes(c.key)).map((c) => (
                  <TableHead key={c.key} className="whitespace-nowrap cursor-pointer"
                    onClick={() => { if (sortKey === c.key) setSortDesc(!sortDesc); else { setSortKey(c.key); setSortDesc(false); } }}>
                    {c.label}{sortKey === c.key ? (sortDesc ? " ↓" : " ↑") : ""}
                  </TableHead>
                ))}
                <TableHead>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((r) => (
                <TableRow key={r.id} className={r.overdue ? "bg-red-50/50" : ""}>
                  {ALL_COLUMNS.filter((c) => visibleCols.includes(c.key)).map((c) => (
                    <TableCell key={c.key} className="whitespace-nowrap max-w-64 truncate">
                      {renderCell(r, c.key)}
                    </TableCell>
                  ))}
                  <TableCell className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setSelectedTaskId(r.id)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => doArchive.mutate({ id: r.id, archived: !r.is_archived })}>
                      {r.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-primary" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف التاسك؟</AlertDialogTitle>
                          <AlertDialogDescription>سيتم حذف "{r.task_name}" — لا يمكن التراجع.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => doDelete.mutate(r.id)}>حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow><TableCell colSpan={visibleCols.length + 1} className="text-center py-16 text-muted-foreground">
                  لا توجد مهام مطابقة
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {view !== "kanban" && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">صفحة {page} من {totalPages}</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>التالي</Button>
          </div>
        </div>
      )}

      <TaskDetailDrawer taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  );
}

function renderCell(r: any, k: string) {
  const v = r[k];
  if (k === "overall_status") return <Badge className={`border ${STATUS_COLOR[v as keyof typeof STATUS_COLOR] ?? ""}`} variant="outline">{v}</Badge>;
  if (k === "priority") return <Badge className={`border ${PRIORITY_COLOR[v as keyof typeof PRIORITY_COLOR] ?? ""}`} variant="outline">{v}</Badge>;
  if (k === "products") return (Array.isArray(v) ? v : []).map((p, i) => <Badge key={i} variant="secondary" className="ml-1">{p}</Badge>);
  if (k === "task_code") return <span className="font-mono text-xs">{v}</span>;
  if (k === "delivered") return v ? "✓" : "—";
  if (k === "files_url" || k === "final_version_url") return v ? <a className="text-primary hover:underline" href={v} target="_blank" rel="noreferrer">فتح</a> : "—";
  if (["request_date","design_start_date","delivery_due_date","actual_delivery_date"].includes(k)) return formatDate(v);
  return v ?? "—";
}
function formatCell(r: any, k: string) {
  const v = r[k];
  if (k === "products") return (Array.isArray(v) ? v : []).join("، ");
  if (["request_date","design_start_date","delivery_due_date","actual_delivery_date"].includes(k)) return formatDate(v);
  if (k === "delivered") return v ? "نعم" : "لا";
  return v ?? "";
}

function KanbanBoard({ rows, onUpdate, onOpen }: { rows: any[]; onUpdate: (id: string, patch: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 overflow-auto">
      {OVERALL_STATUS.map((s) => {
        const cards = rows.filter((r) => r.overall_status === s);
        return (
          <div key={s} className="bg-secondary/50 rounded-lg p-2 min-h-96">
            <div className="text-xs font-semibold px-2 pb-2 flex items-center justify-between">
              <Badge variant="outline" className={STATUS_COLOR[s]}>{s}</Badge>
              <span className="text-muted-foreground">{cards.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {cards.map((c) => (
                <button key={c.id} onClick={() => onOpen(c.id)} className="text-right bg-background rounded-md p-2 border card-soft hover:border-primary transition">
                  <div className="text-sm font-medium truncate">{c.task_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.customer_name}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLOR[c.priority as keyof typeof PRIORITY_COLOR]}`}>{c.priority}</Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">{c.task_code}</span>
                  </div>
                </button>
              ))}
              <Select onValueChange={(v) => { /* placeholder for keyboard move */ }}>
                <SelectTrigger className="h-7 text-xs bg-transparent border-dashed text-muted-foreground">
                  <SelectValue placeholder="نقل تاسك إلى…" />
                </SelectTrigger>
                <SelectContent>
                  {rows.filter((r) => r.overall_status !== s).slice(0, 20).map((r) => (
                    <SelectItem key={r.id} value={r.id} onClick={() => onUpdate(r.id, { overall_status: s })}>
                      {r.task_code} — {r.task_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
