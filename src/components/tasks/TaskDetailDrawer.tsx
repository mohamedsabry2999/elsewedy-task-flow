import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getTask, updateTask, quickUpdateTask, archiveTask,
  listComments, addComment, editComment, deleteComment, pinComment,
  listActivity, listProfiles, myRoles,
} from "@/lib/tasks.functions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  OVERALL_STATUS, DESIGN_STATUS, PRIORITY, CUSTOMER_TYPE, PRODUCT_SERVICE,
  SALES_CHECKLIST_ITEMS, DESIGN_CHECKLIST_ITEMS, STATUS_COLOR, PRIORITY_COLOR,
} from "@/lib/i18n";
import { formatDate, formatDateTime, isOverdue } from "@/lib/format";
import { canEditTaskField, isAdminRole } from "@/lib/permissions";
import { toast } from "sonner";
import {
  AlertTriangle, Zap, Pencil, Archive, ArchiveRestore, Link2, MessageSquare,
  Pin, Trash2, Lock, ClipboardList, User, Palette, Activity as ActivityIcon, Paperclip,
} from "lucide-react";
import { FilesTab } from "@/components/tasks/FilesTab";

const FIELD_LABELS: Record<string, string> = {
  task_name: "اسم التاسك", overall_status: "الحالة العامة", customer_name: "العميل",
  sales_owner_id: "مسؤول السيلز", customer_type: "نوع العميل", products: "المنتج/الخدمة",
  order_details: "تفاصيل الطلب", size_qty_material: "المقاس/الكمية/الخامة",
  design_brief: "المطلوب من التصميم", priority: "الأولوية", request_date: "تاريخ الطلب",
  designer_id: "مسؤول التصميم", design_status: "حالة التصميم", design_start_date: "بدء التصميم",
  delivery_due_date: "موعد التسليم", files_url: "رابط الملفات", designer_notes: "ملاحظات المصمم",
  sales_client_revisions: "تعديلات العميل", final_version_url: "النسخة النهائية",
  actual_delivery_date: "التسليم الفعلي", delivered: "تم التسليم", is_archived: "الأرشفة",
};

export function TaskDetailDrawer({ taskId, open, onClose }: { taskId: string | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTask);
  const commentsFn = useServerFn(listComments);
  const activityFn = useServerFn(listActivity);
  const profilesFn = useServerFn(listProfiles);
  const rolesFn = useServerFn(myRoles);

  const { data: task } = useQuery({
    queryKey: ["task", taskId], queryFn: () => getFn({ data: { id: taskId! } }),
    enabled: !!taskId,
  });
  const { data: comments = [] } = useQuery({
    queryKey: ["comments", taskId], queryFn: () => commentsFn({ data: { task_id: taskId! } }),
    enabled: !!taskId,
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["activity", taskId], queryFn: () => activityFn({ data: { task_id: taskId! } }),
    enabled: !!taskId,
  });
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles-lite"], queryFn: () => profilesFn() });
  const { data: roles = [] } = useQuery({ queryKey: ["my-roles"], queryFn: () => rolesFn() });

  const nameById = useMemo(() => new Map(profiles.map((p) => [p.id, p.full_name || p.email])), [profiles]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
    });
  }, []);
  const own = {
    isSalesOwner: !!currentUserId && !!task && task.sales_owner_id === currentUserId,
    isDesigner: !!currentUserId && !!task && task.designer_id === currentUserId,
  };

  const canEdit = (f: string) => task ? canEditTaskField(roles, f, own) : false;
  const canAdmin = isAdminRole(roles);

  const [quickOpen, setQuickOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  if (!open) return null;
  if (!task) {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="left" className="w-[640px] sm:max-w-[720px]" dir="rtl" />
      </Sheet>
    );
  }

  const overdue = isOverdue(task.delivery_due_date, task.delivered) && task.overall_status !== "مكتمل";

  const copyLink = () => {
    const url = `${window.location.origin}/tasks?open=${task.id}`;
    navigator.clipboard.writeText(url).then(() => toast.success("تم نسخ الرابط"));
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="left" className="w-full sm:max-w-[760px] p-0 overflow-hidden flex flex-col" dir="rtl">
          {/* Header */}
          <div className="border-b bg-gradient-to-l from-primary/5 to-transparent p-5">
            <SheetHeader className="text-right">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs bg-secondary px-2 py-1 rounded">{task.task_code}</span>
                <Badge variant="outline" className={STATUS_COLOR[task.overall_status as keyof typeof STATUS_COLOR]}>
                  {task.overall_status}
                </Badge>
                <Badge variant="outline" className={PRIORITY_COLOR[task.priority as keyof typeof PRIORITY_COLOR]}>
                  {task.priority}
                </Badge>
                {overdue && (
                  <Badge className="bg-red-600 text-white gap-1">
                    <AlertTriangle className="h-3 w-3" /> متأخر
                  </Badge>
                )}
                {task.is_archived && <Badge variant="secondary">مؤرشف</Badge>}
              </div>
              <SheetTitle className="text-lg leading-snug mt-2">{task.task_name}</SheetTitle>
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-y-1 mt-2">
                <div>العميل: <span className="text-foreground">{task.customer_name || "—"}</span></div>
                <div>السيلز: <span className="text-foreground">{nameById.get(task.sales_owner_id ?? "") ?? "—"}</span></div>
                <div>المصمم: <span className="text-foreground">{nameById.get(task.designer_id ?? "") ?? "—"}</span></div>
                <div>التسليم: <span className="text-foreground">{formatDate(task.delivery_due_date)}</span></div>
                <div className="col-span-2">آخر تحديث: {formatDateTime(task.updated_at)}</div>
              </div>
            </SheetHeader>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button size="sm" onClick={() => setQuickOpen(true)}>
                <Zap className="h-4 w-4 ml-1" /> تحديث سريع
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 ml-1" /> تعديل كامل
              </Button>
              <Button size="sm" variant="outline" onClick={copyLink}>
                <Link2 className="h-4 w-4 ml-1" /> نسخ الرابط
              </Button>
              {canAdmin && (
                <Button size="sm" variant="outline" onClick={() => setArchiveConfirm(true)}>
                  {task.is_archived
                    ? <><ArchiveRestore className="h-4 w-4 ml-1" /> استرجاع</>
                    : <><Archive className="h-4 w-4 ml-1" /> أرشفة</>}
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-5 mt-4 grid grid-cols-6">
              <TabsTrigger value="overview"><ClipboardList className="h-3.5 w-3.5 ml-1" /> نظرة عامة</TabsTrigger>
              <TabsTrigger value="sales"><User className="h-3.5 w-3.5 ml-1" /> السيلز</TabsTrigger>
              <TabsTrigger value="design"><Palette className="h-3.5 w-3.5 ml-1" /> التصميم</TabsTrigger>
              <TabsTrigger value="files"><Paperclip className="h-3.5 w-3.5 ml-1" /> الملفات</TabsTrigger>
              <TabsTrigger value="comments"><MessageSquare className="h-3.5 w-3.5 ml-1" /> التعليقات</TabsTrigger>
              <TabsTrigger value="activity"><ActivityIcon className="h-3.5 w-3.5 ml-1" /> السجل</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-5">
              <TabsContent value="overview" className="mt-0">
                <OverviewTab task={task} comments={comments} activity={activity} nameById={nameById} />
              </TabsContent>
              <TabsContent value="sales" className="mt-0">
                <SalesTab task={task} profiles={profiles} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="design" className="mt-0">
                <DesignTab task={task} profiles={profiles} canEdit={canEdit} />
              </TabsContent>
              <TabsContent value="files" className="mt-0">
                <FilesTab
                  taskId={task.id}
                  nameById={nameById}
                  canUpload={canEdit("files_url") || canEdit("final_version_url") || canAdmin}
                  canDelete={canAdmin}
                />
              </TabsContent>
              <TabsContent value="comments" className="mt-0">
                <CommentsTab taskId={task.id} comments={comments} nameById={nameById} canAdmin={canAdmin} roles={roles} />
              </TabsContent>
              <TabsContent value="activity" className="mt-0">
                <ActivityTab activity={activity} nameById={nameById} />
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>

      {quickOpen && (
        <QuickUpdateDialog task={task} profiles={profiles} onClose={() => setQuickOpen(false)} />
      )}
      {editOpen && (
        <FullEditDialog task={task} profiles={profiles} canEdit={canEdit} onClose={() => setEditOpen(false)} />
      )}
      <AlertDialog open={archiveConfirm} onOpenChange={setArchiveConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>{task.is_archived ? "استرجاع التاسك" : "أرشفة التاسك"}</AlertDialogTitle>
            <AlertDialogDescription>
              {task.is_archived
                ? "سيرجع التاسك إلى القائمة النشطة."
                : "سيتم إخفاء التاسك من القوائم النشطة بدون حذفه."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <ArchiveConfirmButton task={task} onDone={() => { setArchiveConfirm(false); }} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------- Tabs ---------------- */

function OverviewTab({
  task, comments, activity, nameById,
}: { task: any; comments: any[]; activity: any[]; nameById: Map<string, string | null> }) {
  const salesCl = (task.sales_checklist ?? {}) as Record<string, boolean>;
  const designCl = (task.design_checklist ?? {}) as Record<string, boolean>;
  const salesPct = Math.round(
    (SALES_CHECKLIST_ITEMS.filter((i) => salesCl[i.key]).length / SALES_CHECKLIST_ITEMS.length) * 100,
  );
  const designPct = Math.round(
    (DESIGN_CHECKLIST_ITEMS.filter((i) => designCl[i.key]).length / DESIGN_CHECKLIST_ITEMS.length) * 100,
  );
  const latestComment = comments[comments.length - 1];
  const latestActivity = activity[0];
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2">
        <ProgressCard label="checklist السيلز" pct={salesPct} />
        <ProgressCard label="checklist التصميم" pct={designPct} />
      </div>
      <div className="grid gap-2 text-sm">
        <div><span className="text-muted-foreground">تفاصيل الطلب: </span>{task.order_details || "—"}</div>
        <div><span className="text-muted-foreground">المقاس/الكمية/الخامة: </span>{task.size_qty_material || "—"}</div>
        <div><span className="text-muted-foreground">المطلوب من التصميم: </span>{task.design_brief || "—"}</div>
        <div><span className="text-muted-foreground">المنتجات: </span>{(task.products || []).join("، ") || "—"}</div>
      </div>
      <Separator />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-1">آخر تعليق</div>
          {latestComment ? (
            <>
              <div className="text-xs">{nameById.get(latestComment.author_id) ?? "—"} · {formatDateTime(latestComment.created_at)}</div>
              <div className="text-sm mt-1 line-clamp-3">{latestComment.body}</div>
            </>
          ) : <div className="text-sm text-muted-foreground">لا يوجد.</div>}
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground mb-1">آخر نشاط</div>
          {latestActivity ? (
            <div className="text-sm">{describeActivity(latestActivity)} · <span className="text-xs text-muted-foreground">{formatDateTime(latestActivity.created_at)}</span></div>
          ) : <div className="text-sm text-muted-foreground">لا يوجد.</div>}
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} />
    </div>
  );
}

function SalesTab({ task, profiles, canEdit }: { task: any; profiles: any[]; canEdit: (f: string) => boolean }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTask);
  const patch = usePatch(updFn, task.id, qc);
  return (
    <div className="grid gap-4">
      <FieldRow label="العميل" locked={!canEdit("customer_name")}>
        <Input defaultValue={task.customer_name}
          disabled={!canEdit("customer_name")}
          onBlur={(e) => e.target.value !== task.customer_name && patch({ customer_name: e.target.value })} />
      </FieldRow>
      <FieldRow label="مسؤول السيلز" locked={!canEdit("sales_owner_id")}>
        <ProfileSelect value={task.sales_owner_id} profiles={profiles}
          disabled={!canEdit("sales_owner_id")} onChange={(v) => patch({ sales_owner_id: v })} />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="نوع العميل" locked={!canEdit("customer_type")}>
          <Select value={task.customer_type ?? ""} disabled={!canEdit("customer_type")}
            onValueChange={(v) => patch({ customer_type: v || null })}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>{CUSTOMER_TYPE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
        <FieldRow label="الأولوية" locked={!canEdit("priority")}>
          <Select value={task.priority} disabled={!canEdit("priority")}
            onValueChange={(v) => patch({ priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
      </div>
      <FieldRow label="المنتج / الخدمة" locked={!canEdit("products")}>
        <div className="flex flex-wrap gap-2 p-2 border rounded-md">
          {PRODUCT_SERVICE.map((p) => {
            const checked = (task.products || []).includes(p);
            return (
              <label key={p} className={`flex items-center gap-1 text-xs ${canEdit("products") ? "cursor-pointer" : "opacity-60"}`}>
                <Checkbox checked={checked} disabled={!canEdit("products")}
                  onCheckedChange={(v) => {
                    const cur: string[] = task.products || [];
                    patch({ products: v ? [...cur, p] : cur.filter((x) => x !== p) });
                  }} />
                {p}
              </label>
            );
          })}
        </div>
      </FieldRow>
      <FieldRow label="تفاصيل الطلب" locked={!canEdit("order_details")}>
        <Textarea defaultValue={task.order_details ?? ""} disabled={!canEdit("order_details")}
          onBlur={(e) => patch({ order_details: e.target.value })} />
      </FieldRow>
      <FieldRow label="المقاس / الكمية / الخامة" locked={!canEdit("size_qty_material")}>
        <Input defaultValue={task.size_qty_material ?? ""} disabled={!canEdit("size_qty_material")}
          onBlur={(e) => patch({ size_qty_material: e.target.value })} />
      </FieldRow>
      <FieldRow label="المطلوب من التصميم" locked={!canEdit("design_brief")}>
        <Textarea defaultValue={task.design_brief ?? ""} disabled={!canEdit("design_brief")}
          onBlur={(e) => patch({ design_brief: e.target.value })} />
      </FieldRow>
      <FieldRow label="تاريخ الطلب" locked={!canEdit("request_date")}>
        <Input type="date" defaultValue={task.request_date ?? ""} disabled={!canEdit("request_date")}
          onBlur={(e) => patch({ request_date: e.target.value || null })} />
      </FieldRow>

      <Separator />
      <div>
        <div className="text-sm font-semibold mb-2">checklist السيلز</div>
        <div className="grid gap-2">
          {SALES_CHECKLIST_ITEMS.map((it) => {
            const cl = (task.sales_checklist as Record<string, boolean>) ?? {};
            return (
              <label key={it.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!cl[it.key]}
                  onCheckedChange={(v) => patch({ sales_checklist: { ...cl, [it.key]: !!v } })} />
                {it.label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DesignTab({ task, profiles, canEdit }: { task: any; profiles: any[]; canEdit: (f: string) => boolean }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTask);
  const patch = usePatch(updFn, task.id, qc);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="مسؤول التصميم" locked={!canEdit("designer_id")}>
          <ProfileSelect value={task.designer_id} profiles={profiles}
            disabled={!canEdit("designer_id")} onChange={(v) => patch({ designer_id: v })} />
        </FieldRow>
        <FieldRow label="حالة التصميم" locked={!canEdit("design_status")}>
          <Select value={task.design_status} disabled={!canEdit("design_status")}
            onValueChange={(v) => patch({ design_status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DESIGN_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="بدء التصميم" locked={!canEdit("design_start_date")}>
          <Input type="date" defaultValue={task.design_start_date ?? ""} disabled={!canEdit("design_start_date")}
            onBlur={(e) => patch({ design_start_date: e.target.value || null })} />
        </FieldRow>
        <FieldRow label="تاريخ التسليم" locked={!canEdit("delivery_due_date")}>
          <Input type="date" defaultValue={task.delivery_due_date ?? ""} disabled={!canEdit("delivery_due_date")}
            onBlur={(e) => patch({ delivery_due_date: e.target.value || null })} />
        </FieldRow>
        <FieldRow label="وقت التسليم" locked={!canEdit("delivery_due_date")}>
          <Input type="time" defaultValue={task.delivery_due_time ?? ""} disabled={!canEdit("delivery_due_date")}
            onBlur={(e) => patch({ delivery_due_time: e.target.value || null })} />
        </FieldRow>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <FieldRow label="سبب الإيقاف (لو الحالة متوقف)">
          <Textarea defaultValue={task.stop_reason ?? ""} onBlur={(e) => patch({ stop_reason: e.target.value || null })} />
        </FieldRow>
        <FieldRow label="ملاحظة التعديل (لو الحالة تعديلات)">
          <Textarea defaultValue={task.revision_note ?? ""} onBlur={(e) => patch({ revision_note: e.target.value || null })} />
        </FieldRow>
        <FieldRow label="سبب إعادة الفتح (عند إعادة فتح مكتمل)">
          <Textarea defaultValue={task.reopen_note ?? ""} onBlur={(e) => patch({ reopen_note: e.target.value || null })} />
        </FieldRow>
      </div>
      <FieldRow label="رابط الملفات" locked={!canEdit("files_url")}>
        <Input type="url" defaultValue={task.files_url ?? ""} disabled={!canEdit("files_url")}
          onBlur={(e) => patch({ files_url: e.target.value || null })} />
      </FieldRow>
      <FieldRow label="ملاحظات المصمم" locked={!canEdit("designer_notes")}>
        <Textarea defaultValue={task.designer_notes ?? ""} disabled={!canEdit("designer_notes")}
          onBlur={(e) => patch({ designer_notes: e.target.value })} />
      </FieldRow>
      <FieldRow label="تعديلات السيلز/العميل" locked={!canEdit("sales_client_revisions")}>
        <Textarea defaultValue={task.sales_client_revisions ?? ""} disabled={!canEdit("sales_client_revisions")}
          onBlur={(e) => patch({ sales_client_revisions: e.target.value })} />
      </FieldRow>
      <FieldRow label="النسخة النهائية (URL)" locked={!canEdit("final_version_url")}>
        <Input type="url" defaultValue={task.final_version_url ?? ""} disabled={!canEdit("final_version_url")}
          onBlur={(e) => patch({ final_version_url: e.target.value || null })} />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="تاريخ التسليم الفعلي" locked={!canEdit("actual_delivery_date")}>
          <Input type="date" defaultValue={task.actual_delivery_date ?? ""} disabled={!canEdit("actual_delivery_date")}
            onBlur={(e) => patch({ actual_delivery_date: e.target.value || null })} />
        </FieldRow>
        <FieldRow label="تم التسليم" locked={!canEdit("delivered")}>
          <label className="flex items-center gap-2 text-sm h-9">
            <Checkbox checked={task.delivered} disabled={!canEdit("delivered")}
              onCheckedChange={(v) => patch({ delivered: !!v })} />
            تم التسليم للعميل
          </label>
        </FieldRow>
      </div>

      <Separator />
      <div>
        <div className="text-sm font-semibold mb-2">checklist التصميم</div>
        <div className="grid gap-2">
          {DESIGN_CHECKLIST_ITEMS.map((it) => {
            const cl = (task.design_checklist as Record<string, boolean>) ?? {};
            return (
              <label key={it.key} className="flex items-center gap-2 text-sm">
                <Checkbox checked={!!cl[it.key]}
                  onCheckedChange={(v) => patch({ design_checklist: { ...cl, [it.key]: !!v } })} />
                {it.label}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CommentsTab({
  taskId, comments, nameById, canAdmin, roles,
}: { taskId: string; comments: any[]; nameById: Map<string, string | null>; canAdmin: boolean; roles: string[] }) {
  const qc = useQueryClient();
  const addFn = useServerFn(addComment);
  const editFn = useServerFn(editComment);
  const delFn  = useServerFn(deleteComment);
  const pinFn  = useServerFn(pinComment);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["comments", taskId] });

  const submit = useMutation({
    mutationFn: () => addFn({ data: { task_id: taskId, body, parent_id: replyTo, is_internal: internal } }),
    onSuccess: () => { setBody(""); setInternal(false); setReplyTo(null); invalidate(); },
    onError: (e: any) => toast.error(e.message || "فشل الإرسال"),
  });

  const pinned = comments.filter((c) => c.is_pinned);
  const roots = comments.filter((c) => !c.parent_id);
  const childrenBy = (id: string) => comments.filter((c) => c.parent_id === id);
  const canPin = canAdmin || roles.includes("sales_manager") || roles.includes("design_manager");

  const renderComment = (c: any, depth = 0) => (
    <div key={c.id} className={`rounded-lg border p-3 ${c.is_internal ? "bg-amber-50/60 border-amber-200" : "bg-secondary/40"}`}
      style={{ marginRight: depth * 16 }}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs">
          <span className="font-semibold">{nameById.get(c.author_id) ?? "—"}</span>
          <span className="text-muted-foreground mx-1">·</span>
          <span className="text-muted-foreground">{formatDateTime(c.created_at)}</span>
          {c.edited_at && <span className="text-muted-foreground mx-1">(معدَّل)</span>}
          {c.is_internal && <Badge variant="secondary" className="mr-2 text-[10px]">داخلي</Badge>}
          {c.is_pinned && <Badge className="mr-2 text-[10px] bg-primary/10 text-primary border-primary/20" variant="outline">مثبت</Badge>}
        </div>
        <div className="flex items-center gap-1">
          {canPin && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title={c.is_pinned ? "إلغاء التثبيت" : "تثبيت"}
              onClick={async () => { await pinFn({ data: { id: c.id, pinned: !c.is_pinned } }); invalidate(); }}>
              <Pin className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" title="رد" onClick={() => setReplyTo(c.id)}>
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="تعديل"
            onClick={() => { setEditingId(c.id); setEditBody(c.body); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="حذف"
            onClick={async () => { await delFn({ data: { id: c.id } }); invalidate(); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {editingId === c.id ? (
        <div className="space-y-2">
          <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={async () => {
              await editFn({ data: { id: c.id, body: editBody } });
              setEditingId(null); invalidate();
            }}>حفظ</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>إلغاء</Button>
          </div>
        </div>
      ) : (
        <div className="text-sm whitespace-pre-wrap">{c.body}</div>
      )}
      <div className="mt-2 space-y-2">
        {childrenBy(c.id).map((ch) => renderComment(ch, depth + 1))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {pinned.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">تعليقات مثبتة</div>
          {pinned.map((c) => renderComment(c))}
          <Separator />
        </div>
      )}
      <div className="space-y-2">
        {roots.filter((c) => !c.is_pinned).map((c) => renderComment(c))}
        {roots.length === 0 && <div className="text-sm text-muted-foreground">لا توجد تعليقات.</div>}
      </div>
      <div className="rounded-lg border p-3 space-y-2">
        {replyTo && (
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>الرد على تعليق</span>
            <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>إلغاء الرد</Button>
          </div>
        )}
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب تعليقاً…" />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={internal} onCheckedChange={(v) => setInternal(!!v)} /> ملاحظة داخلية (لا يراها العميل)
          </label>
          <Button size="sm" disabled={!body.trim() || submit.isPending} onClick={() => submit.mutate()}>إرسال</Button>
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ activity, nameById }: { activity: any[]; nameById: Map<string, string | null> }) {
  if (activity.length === 0) return <div className="text-sm text-muted-foreground">لا يوجد نشاط.</div>;
  return (
    <div className="space-y-2">
      {activity.map((a) => (
        <div key={a.id} className="border-r-2 border-primary pr-3 py-2 text-sm">
          <div>
            <span className="font-semibold">{nameById.get(a.actor_id ?? "") ?? "النظام"}</span>{" "}
            {describeActivity(a)}
          </div>
          <div className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</div>
        </div>
      ))}
    </div>
  );
}

function describeActivity(a: any): string {
  if (a.action === "created") return `أنشأ التاسك ${a.details?.task_code ?? ""}`;
  if (a.action === "note") return `أضاف ملاحظة: ${a.details?.note ?? ""}`;
  if (a.action === "updated") {
    const parts: string[] = [];
    const d = a.details || {};
    for (const k of Object.keys(d)) {
      const label = FIELD_LABELS[k] ?? k;
      const from = d[k]?.from ?? "—";
      const to   = d[k]?.to ?? "—";
      parts.push(`${label}: ${String(from)} → ${String(to)}`);
    }
    return `حدَّث — ${parts.join(" ، ")}`;
  }
  return a.action;
}

/* ---------------- Quick Update Dialog ---------------- */

function QuickUpdateDialog({ task, profiles, onClose }: { task: any; profiles: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const quickFn = useServerFn(quickUpdateTask);
  const [form, setForm] = useState({
    overall_status: task.overall_status,
    design_status: task.design_status,
    priority: task.priority,
    sales_owner_id: task.sales_owner_id ?? "",
    designer_id: task.designer_id ?? "",
    delivery_due_date: task.delivery_due_date ?? "",
    note: "",
  });
  const diff = useMemo(() => {
    const d: Record<string, [any, any]> = {};
    const map: Record<string, any> = {
      overall_status: task.overall_status, design_status: task.design_status,
      priority: task.priority, sales_owner_id: task.sales_owner_id ?? "",
      designer_id: task.designer_id ?? "", delivery_due_date: task.delivery_due_date ?? "",
    };
    for (const k of Object.keys(map)) {
      if ((form as any)[k] !== map[k]) d[k] = [map[k], (form as any)[k]];
    }
    return d;
  }, [form, task]);

  const submit = useMutation({
    mutationFn: () => {
      const patch: Record<string, any> = {};
      for (const k of Object.keys(diff)) {
        patch[k] = k.endsWith("_id") || k === "delivery_due_date" ? (diff[k][1] || null) : diff[k][1];
      }
      return quickFn({ data: { id: task.id, patch, note: form.note.trim() || undefined } });
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["activity", task.id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "فشل التحديث"),
  });

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>تحديث سريع</DialogTitle>
          <DialogDescription>غيّر أهم الحقول بضغطة واحدة — يتم التحقق من قواعد الانتقال قبل الحفظ.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <MiniField label="الحالة العامة">
              <Select value={form.overall_status} onValueChange={(v) => setForm({ ...form, overall_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OVERALL_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </MiniField>
            <MiniField label="حالة التصميم">
              <Select value={form.design_status} onValueChange={(v) => setForm({ ...form, design_status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DESIGN_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </MiniField>
            <MiniField label="الأولوية">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </MiniField>
            <MiniField label="موعد التسليم">
              <Input type="date" value={form.delivery_due_date}
                onChange={(e) => setForm({ ...form, delivery_due_date: e.target.value })} />
            </MiniField>
            <MiniField label="مسؤول السيلز">
              <ProfileSelect value={form.sales_owner_id} profiles={profiles}
                onChange={(v) => setForm({ ...form, sales_owner_id: v ?? "" })} />
            </MiniField>
            <MiniField label="المصمم">
              <ProfileSelect value={form.designer_id} profiles={profiles}
                onChange={(v) => setForm({ ...form, designer_id: v ?? "" })} />
            </MiniField>
          </div>
          <MiniField label="ملاحظة (اختياري)">
            <Textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </MiniField>

          <div className="rounded-lg border bg-secondary/40 p-3 text-xs">
            <div className="font-semibold mb-1">التغييرات:</div>
            {Object.keys(diff).length === 0 ? (
              <div className="text-muted-foreground">لا توجد تغييرات.</div>
            ) : (
              <ul className="space-y-1">
                {Object.entries(diff).map(([k, [from, to]]) => (
                  <li key={k}>
                    <span className="text-muted-foreground">{FIELD_LABELS[k] ?? k}: </span>
                    <span>{String(from) || "—"} → <span className="font-semibold">{String(to) || "—"}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button disabled={Object.keys(diff).length === 0 && !form.note.trim() || submit.isPending}
            onClick={() => submit.mutate()}>حفظ التحديث</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Full Edit Dialog ---------------- */

function FullEditDialog({
  task, profiles, canEdit, onClose,
}: { task: any; profiles: any[]; canEdit: (f: string) => boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const updFn = useServerFn(updateTask);
  const [form, setForm] = useState<any>({ ...task });
  const [confirmClose, setConfirmClose] = useState(false);

  const dirtyKeys = useMemo(() => {
    const keys: string[] = [];
    for (const k of Object.keys(FIELD_LABELS)) {
      const a = (task as any)[k]; const b = (form as any)[k];
      if (Array.isArray(a) || Array.isArray(b)) {
        if (JSON.stringify(a ?? []) !== JSON.stringify(b ?? [])) keys.push(k);
      } else if ((a ?? "") !== (b ?? "")) keys.push(k);
    }
    return keys;
  }, [form, task]);
  const dirty = dirtyKeys.length > 0;

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const handleClose = () => { if (dirty) setConfirmClose(true); else onClose(); };

  const submit = useMutation({
    mutationFn: () => {
      const patch: Record<string, any> = {};
      for (const k of dirtyKeys) patch[k] = (form as any)[k];
      return updFn({ data: { id: task.id, patch } });
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["activity", task.id] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && handleClose()}>
        <DialogContent dir="rtl" className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل كامل — {task.task_code}</DialogTitle>
            <DialogDescription>
              {dirty ? <span className="text-amber-700">هناك {dirtyKeys.length} تغيير(ات) غير محفوظة</span> : "لا توجد تغييرات."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <section className="space-y-3">
              <div className="text-sm font-semibold text-primary">أساسي</div>
              <MiniField label="اسم التاسك">
                <Input value={form.task_name} disabled={!canEdit("task_name")}
                  onChange={(e) => upd("task_name", e.target.value)} />
              </MiniField>
              <MiniField label="الحالة العامة">
                <Select value={form.overall_status} disabled={!canEdit("overall_status")}
                  onValueChange={(v) => upd("overall_status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OVERALL_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </MiniField>
            </section>

            <section className="space-y-3">
              <div className="text-sm font-semibold text-primary">السيلز</div>
              <div className="grid grid-cols-2 gap-3">
                <MiniField label="العميل">
                  <Input value={form.customer_name ?? ""} disabled={!canEdit("customer_name")}
                    onChange={(e) => upd("customer_name", e.target.value)} />
                </MiniField>
                <MiniField label="مسؤول السيلز">
                  <ProfileSelect value={form.sales_owner_id} profiles={profiles}
                    disabled={!canEdit("sales_owner_id")}
                    onChange={(v) => upd("sales_owner_id", v)} />
                </MiniField>
                <MiniField label="نوع العميل">
                  <Select value={form.customer_type ?? ""} disabled={!canEdit("customer_type")}
                    onValueChange={(v) => upd("customer_type", v || null)}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{CUSTOMER_TYPE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </MiniField>
                <MiniField label="الأولوية">
                  <Select value={form.priority} disabled={!canEdit("priority")}
                    onValueChange={(v) => upd("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </MiniField>
              </div>
              <MiniField label="المنتج / الخدمة">
                <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                  {PRODUCT_SERVICE.map((p) => {
                    const checked = (form.products || []).includes(p);
                    return (
                      <label key={p} className={`flex items-center gap-1 text-xs ${canEdit("products") ? "cursor-pointer" : "opacity-60"}`}>
                        <Checkbox checked={checked} disabled={!canEdit("products")}
                          onCheckedChange={(v) => {
                            const cur: string[] = form.products || [];
                            upd("products", v ? [...cur, p] : cur.filter((x) => x !== p));
                          }} />
                        {p}
                      </label>
                    );
                  })}
                </div>
              </MiniField>
              <MiniField label="تفاصيل الطلب">
                <Textarea value={form.order_details ?? ""} disabled={!canEdit("order_details")}
                  onChange={(e) => upd("order_details", e.target.value)} />
              </MiniField>
              <MiniField label="المقاس / الكمية / الخامة">
                <Input value={form.size_qty_material ?? ""} disabled={!canEdit("size_qty_material")}
                  onChange={(e) => upd("size_qty_material", e.target.value)} />
              </MiniField>
              <MiniField label="المطلوب من التصميم">
                <Textarea value={form.design_brief ?? ""} disabled={!canEdit("design_brief")}
                  onChange={(e) => upd("design_brief", e.target.value)} />
              </MiniField>
              <MiniField label="تاريخ الطلب">
                <Input type="date" value={form.request_date ?? ""} disabled={!canEdit("request_date")}
                  onChange={(e) => upd("request_date", e.target.value || null)} />
              </MiniField>
            </section>

            <section className="space-y-3">
              <div className="text-sm font-semibold text-primary">التصميم</div>
              <div className="grid grid-cols-2 gap-3">
                <MiniField label="المصمم">
                  <ProfileSelect value={form.designer_id} profiles={profiles}
                    disabled={!canEdit("designer_id")}
                    onChange={(v) => upd("designer_id", v)} />
                </MiniField>
                <MiniField label="حالة التصميم">
                  <Select value={form.design_status} disabled={!canEdit("design_status")}
                    onValueChange={(v) => upd("design_status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DESIGN_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </MiniField>
                <MiniField label="بدء التصميم">
                  <Input type="date" value={form.design_start_date ?? ""} disabled={!canEdit("design_start_date")}
                    onChange={(e) => upd("design_start_date", e.target.value || null)} />
                </MiniField>
                <MiniField label="موعد التسليم">
                  <Input type="date" value={form.delivery_due_date ?? ""} disabled={!canEdit("delivery_due_date")}
                    onChange={(e) => upd("delivery_due_date", e.target.value || null)} />
                </MiniField>
              </div>
              <MiniField label="رابط الملفات">
                <Input type="url" value={form.files_url ?? ""} disabled={!canEdit("files_url")}
                  onChange={(e) => upd("files_url", e.target.value || null)} />
              </MiniField>
              <MiniField label="ملاحظات المصمم">
                <Textarea value={form.designer_notes ?? ""} disabled={!canEdit("designer_notes")}
                  onChange={(e) => upd("designer_notes", e.target.value)} />
              </MiniField>
              <MiniField label="تعديلات السيلز/العميل">
                <Textarea value={form.sales_client_revisions ?? ""} disabled={!canEdit("sales_client_revisions")}
                  onChange={(e) => upd("sales_client_revisions", e.target.value)} />
              </MiniField>
              <MiniField label="النسخة النهائية (URL)">
                <Input type="url" value={form.final_version_url ?? ""} disabled={!canEdit("final_version_url")}
                  onChange={(e) => upd("final_version_url", e.target.value || null)} />
              </MiniField>
              <div className="grid grid-cols-2 gap-3">
                <MiniField label="تاريخ التسليم الفعلي">
                  <Input type="date" value={form.actual_delivery_date ?? ""} disabled={!canEdit("actual_delivery_date")}
                    onChange={(e) => upd("actual_delivery_date", e.target.value || null)} />
                </MiniField>
                <MiniField label="تم التسليم">
                  <label className="flex items-center gap-2 text-sm h-9">
                    <Checkbox checked={!!form.delivered} disabled={!canEdit("delivered")}
                      onCheckedChange={(v) => upd("delivered", !!v)} />
                    تم التسليم للعميل
                  </label>
                </MiniField>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={handleClose}>إغلاق</Button>
            <Button disabled={!dirty || submit.isPending} onClick={() => submit.mutate()}>
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هناك تغييرات غير محفوظة</AlertDialogTitle>
            <AlertDialogDescription>هل تريد الخروج بدون حفظ؟</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>البقاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmClose(false); onClose(); }}>خروج بدون حفظ</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ---------------- Helpers ---------------- */

function FieldRow({ label, locked, children }: { label: string; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs flex items-center gap-1">
        {label}
        {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
      </Label>
      {children}
    </div>
  );
}
function MiniField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}

function ProfileSelect({
  value, profiles, onChange, disabled,
}: { value: string | null | undefined; profiles: any[]; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <Select value={value ?? ""} disabled={disabled} onValueChange={(v) => onChange(v || null)}>
      <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
      <SelectContent>
        {profiles.map((p) => (
          <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function usePatch(updFn: any, id: string, qc: any) {
  const m = useMutation({
    mutationFn: (p: Record<string, unknown>) => updFn({ data: { id, patch: p } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["activity", id] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e.message || "فشل التحديث"),
  });
  return (p: Record<string, unknown>) => m.mutate(p);
}

function ArchiveConfirmButton({ task, onDone }: { task: any; onDone: () => void }) {
  const qc = useQueryClient();
  const archFn = useServerFn(archiveTask);
  const m = useMutation({
    mutationFn: () => archFn({ data: { id: task.id, archived: !task.is_archived } }),
    onSuccess: () => {
      toast.success(task.is_archived ? "تم الاسترجاع" : "تمت الأرشفة");
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onDone();
    },
    onError: (e: any) => toast.error(e.message || "فشل"),
  });
  return (
    <AlertDialogAction onClick={(e) => { e.preventDefault(); m.mutate(); }}>
      {task.is_archived ? "استرجاع" : "أرشفة"}
    </AlertDialogAction>
  );
}
