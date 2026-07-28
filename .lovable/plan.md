# Final Security, Notifications & Workflow QA — خطة التنفيذ

الطلب كبير جدًا (17 قسم). سأنفّذه على 8 دفعات آمنة متتابعة بدون إعادة بناء المشروع، مع الحفاظ على البيانات والتصميم والـRTL والخط Cairo واللوجو الحالي.

## قبل البدء — فحص سريع للوضع الحالي
- قراءة `overdue-scan.ts`, `TaskDetailDrawer.tsx`, `TasksExplorer.tsx`, `route.tsx (authenticated)`, `settings.tsx`, `tasks.functions.ts`, `permissions.ts`, `notification-sound.ts`, ملف RLS الحالي لـ`task-files`.
- التأكد من أعمدة `notifications` و`tasks.due_at` و`notification_preferences`.

## الدفعة 1 — تأمين overdue-scan + Cron حقيقي (بند 1)
- إنشاء Secret `OVERDUE_SCAN_SECRET` عبر `generate_secret`.
- تعديل `/api/public/hooks/overdue-scan.ts`:
  - رفض GET، قبول POST فقط.
  - قراءة `Authorization: Bearer <OVERDUE_SCAN_SECRET>` بمقارنة `timingSafeEqual`.
  - Rate limit بسيط (In-memory per-IP: 6/min).
  - استجابة عامة `{ok:true}` بدون تفاصيل داخلية عند الخطأ.
  - Logs مختصرة server-side.
- إعادة جدولة `pg_cron` كل ساعة بالـSecret الجديد (استخدام `supabase--insert` لأنه بيانات وليس schema).
- التوقيت Africa/Cairo مضمون عبر `due_at` (محسوب من `set_task_due_at`).
- تحديث README بخطوات إعداد Secret/Cron (بدون قيمة).

## الدفعة 2 — موعد التسليم بتاريخ ووقت (بند 2) + قواعد الحالات (بند 10)
- Migration واحد:
  - إضافة `delivery_due_time TIME` (nullable) — لا نغيّر `delivery_due_date`.
  - تعديل `set_task_due_at` لدمج التاريخ + الوقت (افتراضي 23:59) بتوقيت Africa/Cairo.
  - إضافة `stop_reason TEXT`, `revision_note TEXT`, `reopen_note TEXT` على `tasks`.
  - تحديث `validate_task_transitions`:
    - "متوقف" ⇐ يتطلّب `stop_reason`.
    - "تعديلات" ⇐ يتطلّب `revision_note` (أو `sales_client_revisions`).
    - إعادة فتح من "مكتمل" ⇐ يتطلّب `reopen_note` + admin/manager.
    - "مكتمل" ⇐ ملف من نوع "نهائية" **أو** `final_version_url` + `delivered=true` + `actual_delivery_date`.
  - Trigger يسجّل السبب/الملاحظة داخل `task_activity`.
- UI: حقل `TimePicker` بجانب التاريخ في Quick Update و Full Edit، عرض الوقت 12-ساعة ص/م في الجدول والـDrawer والإشعارات.

## الدفعة 3 — إشعارات: منع تكرار الصوت + تفعيل صحيح + Deep Link (بنود 3، 4، 5)
- `src/lib/notification-audio.ts` (جديد):
  - `BroadcastChannel('elsewedy-notif-audio')` لمزامنة التابات.
  - قبل التشغيل: `update notifications set played_at=now() where id=? and played_at is null returning id` — إذا لم يرجع صف، لا تشغّل.
  - Deduplication key = `notification.id`.
- Banner "فعّل صوت التنبيهات" داخل TopBar عند عدم وجود موافقة محلية؛ زر واحد يستدعي `unlockAudio` + صوت تجريبي + حفظ في `notification_preferences.sounds_enabled=true`.
- إصلاح زر الصوت الحالي (أول ضغطة = تفعيل).
- منع تداخل الصفارات (mutex بسيط).
- إشعار → Deep link: `/tasks?open=<task_id>` — يعمل بعد Refresh، يفتح Drawer، يعلّم كمقروء، رسالة واضحة لو محذوف/بدون صلاحية.

## الدفعة 4 — تطوير مركز الإشعارات + الأنواع (بند 6) + Reminders (بند 14)
- Dropdown بتبويبات (الكل/غير المقروء/عاجل)، Load More، عداد، Pulse أحمر عاجل، زر "فتح التاسك"، Empty State، "تعليم الكل كمقروء".
- Migration: إضافة triggers للأحداث الناقصة (revision request, task stopped/reopened, final uploaded)، deduplication في `overdue_events` مع `stage` (24h/4h/1h/overdue).
- تحديث `overdue-scan` ليولّد reminders بالمراحل الأربع مع dedupe، ولا يشمل مؤرشف/محذوف/متوقف/مكتمل.

## الدفعة 5 — إعدادات الإشعارات الكاملة (بند 7) + Desktop Notifications (بند 13)
- توسيع `notification_preferences`: `desktop_enabled`, `event_toggles jsonb`, `work_hours`, `quiet_hours_start/end` (موجود جزئيًا)، `overdue_repeat` (1h/2h/4h/daily)، `notify_outside_hours`.
- صفحة `settings.tsx`: كل الخيارات المطلوبة + زر طلب Permission + عرض الحالة + Reset defaults.
- Web Notifications API عند الأحداث المحددة، مع احترام Quiet Hours وعدم عرضها لو المستخدم داخل نفس التاسك.

## الدفعة 6 — تأمين ملفات التاسكات (بنود 8، 9)
- Storage RLS policies جديدة على `storage.objects` bucket `task-files`:
  - SELECT/INSERT/DELETE مقيّدة بدالة `public.can_access_task_files(task_id, user_id)` تفحص admin/manager/sales_owner/designer/override.
- `listTaskFiles`, `signTaskFileUrl`, `recordTaskFile`, `deleteTaskFile` — فحص server-side قبل أي عملية.
- حد حجم (25MB) + قائمة MIME مسموحة، رسائل واضحة.
- ربط بالمراحل: `validate_task_transitions` يستدعي وجود مرفق "نهائية" لحالة "مكتمل"، ومرفق أي نوع لـ"بانتظار الاعتماد".

## الدفعة 7 — Permissions Overrides حقيقية (بند 11) + تحسين التعديل (بند 12)
- دالة `public.effective_permission(user_id, key)` تطبّق الأولوية: SuperAdmin > Override > Role > Ownership.
- استخدامها في `enforce_task_field_permissions` و`can_access_task_files`.
- تسجيل تغييرات الـoverrides في `task_activity`/audit.
- Optimistic locking: فحص `updated_at` قبل الحفظ في `quickUpdateTask` و`updateTask`؛ رسالة تعارض عربية.
- تسجيل جميع تغييرات الحقول (from→to) — موجود جزئيًا، إكمال الحقول الناقصة.

## الدفعة 8 — Mobile/Responsive + QA نهائي (بنود 15، 16، 17)
- مراجعة 360/390/768: Drawer full-screen موبايل، Tabs scrollable، جدول → cards، Sheet sidebar، جرس على الموبايل.
- تشغيل build/typecheck/lint.
- Playwright: سيناريوهات RLS/permissions/notification dedupe/deep-link/transition rules (المتاح منها بدون auth مركّب).
- تقرير نهائي.

## ملاحظات تقنية
- كل schema change → migration منفصل (لن تُدمج مع كتابة كود في نفس النداء).
- لن نمس `client.ts` أو `types.ts` الآلية.
- لن نغيّر اللوجو (مثبّت بالفعل)، فقط نتأكد من ظهوره في auth/sidebar/mobile/favicon.
- كل الأصوات تبقى عبر WebAudio synth الحالي (بدون MP3 خارجية).

## خطوات يدوية متوقعة منك
- الموافقة على الـmigrations عند ظهورها.
- (اختياري) مراجعة قيمة `OVERDUE_SCAN_SECRET` بعد التوليد — لن أعرضها.

هل تريد أن أبدأ فورًا بالدفعة 1؟
