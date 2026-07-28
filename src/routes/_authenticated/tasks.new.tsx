import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createTask, listProfiles } from "@/lib/tasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CUSTOMER_TYPE, MONTHS, PRIORITY, PRODUCT_SERVICE, OVERALL_STATUS } from "@/lib/i18n";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  component: NewTaskPage,
  head: () => ({ meta: [{ title: "تاسك جديد — Elsewedy Task Flow" }] }),
});

function NewTaskPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<any>({
    task_name: "", month_code: "AUG", overall_status: "جديد",
    customer_name: "", customer_type: "عميل حالي", products: [] as string[],
    order_details: "", size_qty_material: "", design_brief: "",
    priority: "عادية", request_date: new Date().toISOString().slice(0, 10),
    designer_id: null, delivery_due_date: null, delivery_due_time: null,
  });
  const set = (patch: any) => setState((s: any) => ({ ...s, ...patch }));

  const createFn = useServerFn(createTask);
  const profilesFn = useServerFn(listProfiles);
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles-lite"], queryFn: () => profilesFn() });

  const submit = useMutation({
    mutationFn: () => createFn({ data: state }),
    onSuccess: (row) => { toast.success(`تم إنشاء ${row.task_code}`); navigate({ to: "/tasks" }); },
    onError: (e: any) => toast.error(e.message || "فشل الإنشاء"),
  });

  const canNext = () => {
    if (step === 1) return state.task_name.trim().length > 0;
    if (step === 2) return state.customer_name.trim().length > 0 && state.products.length > 0;
    return true;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">تاسك جديد</h1>
        <p className="text-sm text-muted-foreground">الخطوة {step} من 3</p>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`flex-1 h-1.5 rounded-full ${n <= step ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>
          {step === 1 && "بيانات أساسية"}
          {step === 2 && "بيانات السيلز"}
          {step === 3 && "بيانات التصميم والمراجعة"}
        </CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {step === 1 && (
            <>
              <Field label="اسم التاسك *"><Input value={state.task_name} onChange={(e) => set({ task_name: e.target.value })} /></Field>
              <Field label="الشهر">
                <Select value={state.month_code} onValueChange={(v) => set({ month_code: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m) => <SelectItem key={m.code} value={m.code}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="الحالة العامة">
                <Select value={state.overall_status} onValueChange={(v) => set({ overall_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OVERALL_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <Field label="اسم العميل *"><Input value={state.customer_name} onChange={(e) => set({ customer_name: e.target.value })} /></Field>
              <Field label="نوع العميل">
                <Select value={state.customer_type} onValueChange={(v) => set({ customer_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CUSTOMER_TYPE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="المنتج / الخدمة *">
                <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                  {PRODUCT_SERVICE.map((p) => {
                    const checked = state.products.includes(p);
                    return (
                      <label key={p} className="flex items-center gap-1 text-sm cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={(v) => {
                          const next = v ? [...state.products, p] : state.products.filter((x: string) => x !== p);
                          set({ products: next });
                        }} />
                        {p}
                      </label>
                    );
                  })}
                </div>
              </Field>
              <Field label="تفاصيل الطلب"><Textarea value={state.order_details} onChange={(e) => set({ order_details: e.target.value })} /></Field>
              <Field label="المقاس / الكمية / الخامة"><Input value={state.size_qty_material} onChange={(e) => set({ size_qty_material: e.target.value })} /></Field>
              <Field label="المطلوب من التصميم"><Textarea value={state.design_brief} onChange={(e) => set({ design_brief: e.target.value })} /></Field>
              <Field label="الأولوية">
                <Select value={state.priority} onValueChange={(v) => set({ priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="تاريخ إرسال الطلب"><Input type="date" value={state.request_date ?? ""} onChange={(e) => set({ request_date: e.target.value })} /></Field>
            </>
          )}
          {step === 3 && (
            <>
              <Field label="مسؤول التصميم">
                <Select value={state.designer_id ?? ""} onValueChange={(v) => set({ designer_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="تاريخ التسليم">
                <Input type="date" value={state.delivery_due_date ?? ""} onChange={(e) => set({ delivery_due_date: e.target.value || null })} />
              </Field>
              <Field label="وقت التسليم">
                <Input type="time" value={state.delivery_due_time ?? ""} onChange={(e) => set({ delivery_due_time: e.target.value || null })} />
              </Field>
              <div className="text-sm text-muted-foreground p-3 bg-secondary/50 rounded">
                <div><strong>ملخص:</strong> {state.task_name}</div>
                <div>الشهر: {MONTHS.find((m) => m.code === state.month_code)?.label} · الأولوية: {state.priority}</div>
                <div>العميل: {state.customer_name || "—"} · المنتجات: {state.products.join("، ") || "—"}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => (step > 1 ? setStep(step - 1) : navigate({ to: "/tasks" }))}>
          {step > 1 ? "السابق" : "إلغاء"}
        </Button>
        {step < 3 ? (
          <Button disabled={!canNext()} onClick={() => setStep(step + 1)}>التالي</Button>
        ) : (
          <Button disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? "جارٍ..." : "إنشاء التاسك"}
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label>{label}</Label>{children}</div>;
}
