import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { loadDemoData, removeDemoData } from "@/lib/admin.functions";
import { getNotificationPrefs, saveNotificationPrefs } from "@/lib/tasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { playNormal, playSiren, unlockAudio } from "@/lib/notification-sound";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "الإعدادات — Elsewedy Task Flow" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const loadFn = useServerFn(loadDemoData);
  const removeFn = useServerFn(removeDemoData);
  const prefsFn = useServerFn(getNotificationPrefs);
  const savePrefsFn = useServerFn(saveNotificationPrefs);

  const { data: prefs } = useQuery({ queryKey: ["notif-prefs"], queryFn: () => prefsFn() });

  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [volNormal, setVolNormal] = useState(60);
  const [volUrgent, setVolUrgent] = useState(90);

  useEffect(() => {
    if (!prefs) return;
    setSoundsEnabled(prefs.sounds_enabled !== false);
    setVolNormal(prefs.volume_normal ?? 60);
    setVolUrgent(prefs.volume_urgent ?? 90);
  }, [prefs]);

  const save = useMutation({
    mutationFn: () => savePrefsFn({ data: {
      sounds_enabled: soundsEnabled, volume_normal: volNormal, volume_urgent: volUrgent,
    }}),
    onSuccess: () => { toast.success("تم حفظ التفضيلات"); qc.invalidateQueries({ queryKey: ["notif-prefs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

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
        <p className="text-sm text-muted-foreground">تكوين النظام والإشعارات والبيانات التجريبية</p>
      </div>

      <Card className="card-soft">
        <CardHeader><CardTitle className="text-base">تنبيهات الصوت</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>تشغيل صوت الإشعارات</Label>
            <Switch checked={soundsEnabled} onCheckedChange={(v) => { setSoundsEnabled(v); unlockAudio(); }} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">مستوى الصوت العادي: {volNormal}%</Label>
            <Slider min={0} max={100} value={[volNormal]} onValueChange={([v]) => setVolNormal(v)} />
            <Button size="sm" variant="outline" onClick={() => { unlockAudio(); playNormal(volNormal / 100); }}>
              تجربة
            </Button>
          </div>
          <div className="space-y-2">
            <Label className="text-sm">مستوى صوت الصفارة (عاجل): {volUrgent}%</Label>
            <Slider min={0} max={100} value={[volUrgent]} onValueChange={([v]) => setVolUrgent(v)} />
            <Button size="sm" variant="outline" onClick={() => { unlockAudio(); playSiren(volUrgent / 100); }}>
              تجربة الصفارة
            </Button>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>حفظ التفضيلات</Button>
        </CardContent>
      </Card>

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
