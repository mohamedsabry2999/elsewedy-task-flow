import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadDemoData, removeDemoData } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "الإعدادات — Elsewedy Task Flow" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const loadFn = useServerFn(loadDemoData);
  const removeFn = useServerFn(removeDemoData);

  const load = useMutation({
    mutationFn: () => loadFn(),
    onSuccess: (r) => { toast.success(`تم إدراج ${r.inserted} تاسك تجريبي`); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message || "فشل"),
  });
  const remove = useMutation({
    mutationFn: () => removeFn(),
    onSuccess: (r) => { toast.success(`تم حذف ${r.deleted} تاسك تجريبي`); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message || "فشل"),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground">تكوين النظام والبيانات التجريبية</p>
      </div>

      <Card className="card-soft">
        <CardHeader><CardTitle className="text-base">المنطقة الزمنية</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          كل التواريخ تُعرض بتوقيت القاهرة (Africa/Cairo) بصيغة 12 ساعة (ص/م).
        </CardContent>
      </Card>

      <Card className="card-soft">
        <CardHeader><CardTitle className="text-base">البيانات التجريبية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            محدود للأدمن. البيانات التجريبية معلمة بوضوح ويمكن حذفها في أي وقت دون تأثير على البيانات الحقيقية.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => load.mutate()} disabled={load.isPending}>تحميل بيانات تجريبية</Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">حذف البيانات التجريبية</Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف كل البيانات التجريبية؟</AlertDialogTitle>
                  <AlertDialogDescription>سيتم حذف كل التاسكات المعلمة كتجريبية فقط. البيانات الحقيقية لن تتأثر.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate()}>حذف</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
