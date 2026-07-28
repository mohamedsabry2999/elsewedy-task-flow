import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTask, updateTask, listComments, addComment, listActivity, listProfiles } from "@/lib/tasks.functions";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  OVERALL_STATUS, DESIGN_STATUS, PRIORITY, CUSTOMER_TYPE, PRODUCT_SERVICE,
  SALES_CHECKLIST_ITEMS, DESIGN_CHECKLIST_ITEMS, STATUS_COLOR, PRIORITY_COLOR,
} from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";

export function TaskDetailDrawer({ taskId, open, onClose }: { taskId: string | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getTask);
  const updFn = useServerFn(updateTask);
  const commentsFn = useServerFn(listComments);
  const addCommentFn = useServerFn(addComment);
  const activityFn = useServerFn(listActivity);
  const profilesFn = useServerFn(listProfiles);

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
  const nameById = new Map(profiles.map((p) => [p.id, p.full_name || p.email]));

  const [comment, setComment] = useState("");

  const patch = useMutation({
    mutationFn: (p: Record<string, unknown>) => updFn({ data: { id: taskId!, patch: p } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["activity", taskId] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: any) => toast.error(e.message || "فشل التحديث"),
  });

  const addC = useMutation({
    mutationFn: () => addCommentFn({ data: { task_id: taskId!, body: comment } }),
    onSuccess: () => { setComment(""); qc.invalidateQueries({ queryKey: ["comments", taskId] }); },
  });

  if (!task && open) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-[540px] sm:max-w-[640px] overflow-y-auto" dir="rtl">
        {task && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs bg-secondary px-2 py-1 rounded">{task.task_code}</span>
                <span>{task.task_name}</span>
              </SheetTitle>
              <div className="flex gap-2 items-center">
                <Badge variant="outline" className={STATUS_COLOR[task.overall_status as keyof typeof STATUS_COLOR]}>{task.overall_status}</Badge>
                <Badge variant="outline" className={PRIORITY_COLOR[task.priority as keyof typeof PRIORITY_COLOR]}>{task.priority}</Badge>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              <Section title="بيانات أساسية">
                <Field label="اسم التاسك">
                  <Input defaultValue={task.task_name} onBlur={(e) => e.target.value !== task.task_name && patch.mutate({ task_name: e.target.value })} />
                </Field>
                <Field label="الحالة العامة">
                  <Select value={task.overall_status} onValueChange={(v) => patch.mutate({ overall_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OVERALL_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </Section>

              <Section title="بيانات السيلز">
                <Field label="العميل">
                  <Input defaultValue={task.customer_name} onBlur={(e) => e.target.value !== task.customer_name && patch.mutate({ customer_name: e.target.value })} />
                </Field>
                <Field label="مسؤول السيلز">
                  <Select value={task.sales_owner_id ?? ""} onValueChange={(v) => patch.mutate({ sales_owner_id: v || null })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="نوع العميل">
                  <Select value={task.customer_type ?? ""} onValueChange={(v) => patch.mutate({ customer_type: v || null })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{CUSTOMER_TYPE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="الأولوية">
                  <Select value={task.priority} onValueChange={(v) => patch.mutate({ priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="المنتج / الخدمة">
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                    {PRODUCT_SERVICE.map((p) => {
                      const checked = (task.products || []).includes(p);
                      return (
                        <label key={p} className="flex items-center gap-1 text-xs cursor-pointer">
                          <Checkbox checked={checked} onCheckedChange={(v) => {
                            const cur: string[] = task.products || [];
                            const next = v ? [...cur, p] : cur.filter((x) => x !== p);
                            patch.mutate({ products: next });
                          }} />
                          {p}
                        </label>
                      );
                    })}
                  </div>
                </Field>
                <Field label="تفاصيل الطلب">
                  <Textarea defaultValue={task.order_details ?? ""} onBlur={(e) => patch.mutate({ order_details: e.target.value })} />
                </Field>
                <Field label="المقاس / الكمية / الخامة">
                  <Input defaultValue={task.size_qty_material ?? ""} onBlur={(e) => patch.mutate({ size_qty_material: e.target.value })} />
                </Field>
                <Field label="المطلوب من التصميم">
                  <Textarea defaultValue={task.design_brief ?? ""} onBlur={(e) => patch.mutate({ design_brief: e.target.value })} />
                </Field>
                <Field label="تاريخ إرسال الطلب">
                  <Input type="date" defaultValue={task.request_date ?? ""} onBlur={(e) => patch.mutate({ request_date: e.target.value || null })} />
                </Field>
              </Section>

              <Section title="checklist السيلز">
                {SALES_CHECKLIST_ITEMS.map((it) => {
                  const cl = (task.sales_checklist as Record<string, boolean> | null) ?? {};
                  return (
                    <label key={it.key} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!cl[it.key]}
                        onCheckedChange={(v) => patch.mutate({ sales_checklist: { ...cl, [it.key]: !!v } })} />
                      {it.label}
                    </label>
                  );
                })}
              </Section>

              <Section title="بيانات التصميم">
                <Field label="مسؤول التصميم">
                  <Select value={task.designer_id ?? ""} onValueChange={(v) => patch.mutate({ designer_id: v || null })}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="حالة التصميم">
                  <Select value={task.design_status} onValueChange={(v) => patch.mutate({ design_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DESIGN_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="تاريخ بدء التصميم">
                  <Input type="date" defaultValue={task.design_start_date ?? ""} onBlur={(e) => patch.mutate({ design_start_date: e.target.value || null })} />
                </Field>
                <Field label="موعد التسليم">
                  <Input type="date" defaultValue={task.delivery_due_date ?? ""} onBlur={(e) => patch.mutate({ delivery_due_date: e.target.value || null })} />
                </Field>
                <Field label="رابط الملفات">
                  <Input type="url" defaultValue={task.files_url ?? ""} onBlur={(e) => patch.mutate({ files_url: e.target.value || null })} />
                </Field>
                <Field label="ملاحظات المصمم">
                  <Textarea defaultValue={task.designer_notes ?? ""} onBlur={(e) => patch.mutate({ designer_notes: e.target.value })} />
                </Field>
                <Field label="تعديلات السيلز/العميل">
                  <Textarea defaultValue={task.sales_client_revisions ?? ""} onBlur={(e) => patch.mutate({ sales_client_revisions: e.target.value })} />
                </Field>
                <Field label="النسخة النهائية (URL)">
                  <Input type="url" defaultValue={task.final_version_url ?? ""} onBlur={(e) => patch.mutate({ final_version_url: e.target.value || null })} />
                </Field>
                <Field label="تاريخ التسليم الفعلي">
                  <Input type="date" defaultValue={task.actual_delivery_date ?? ""} onBlur={(e) => patch.mutate({ actual_delivery_date: e.target.value || null })} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={task.delivered} onCheckedChange={(v) => patch.mutate({ delivered: !!v })} />
                  تم التسليم
                </label>
              </Section>

              <Section title="checklist التصميم">
                {DESIGN_CHECKLIST_ITEMS.map((it) => {
                  const cl = (task.design_checklist as Record<string, boolean> | null) ?? {};
                  return (
                    <label key={it.key} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={!!cl[it.key]}
                        onCheckedChange={(v) => patch.mutate({ design_checklist: { ...cl, [it.key]: !!v } })} />
                      {it.label}
                    </label>
                  );
                })}
              </Section>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-2">التعليقات</h3>
                <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                  {comments.map((c) => (
                    <div key={c.id} className="bg-secondary/50 rounded p-2 text-sm">
                      <div className="text-xs text-muted-foreground">{nameById.get(c.author_id) ?? "—"} · {formatDateTime(c.created_at)}</div>
                      <div>{c.body}</div>
                    </div>
                  ))}
                  {comments.length === 0 && <div className="text-xs text-muted-foreground">لا توجد تعليقات.</div>}
                </div>
                <div className="flex gap-2">
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="أضف تعليقاً..." />
                  <Button onClick={() => addC.mutate()} disabled={!comment.trim()}>إرسال</Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">سجل النشاط</h3>
                <div className="space-y-1 text-xs max-h-64 overflow-y-auto">
                  {activity.map((a) => (
                    <div key={a.id} className="border-r-2 border-primary pr-2 py-1">
                      <div>{nameById.get(a.actor_id ?? "") ?? "—"} · <span className="font-medium">{a.action}</span></div>
                      <div className="text-muted-foreground">{formatDateTime(a.created_at)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-3 text-primary">{title}</h3>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
