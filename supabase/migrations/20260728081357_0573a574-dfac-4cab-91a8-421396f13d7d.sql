
-- === Phase D: Storage RLS for task-files bucket ===
-- Path convention: tasks/<task_id>/<filename>
CREATE POLICY "task_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'task-files');

CREATE POLICY "task_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-files' AND owner = auth.uid());

CREATE POLICY "task_files_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'task-files' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'task-files' AND owner = auth.uid());

CREATE POLICY "task_files_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'task-files' AND (owner = auth.uid() OR public.is_admin(auth.uid())));

-- === Phase F: Notifications enhancements ===
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS played_at timestamptz;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sounds_enabled boolean NOT NULL DEFAULT true,
  volume_normal integer NOT NULL DEFAULT 60,
  volume_urgent integer NOT NULL DEFAULT 90,
  quiet_hours_start smallint,
  quiet_hours_end smallint,
  event_toggles jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "np_self" ON public.notification_preferences;
CREATE POLICY "np_self" ON public.notification_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS np_touch ON public.notification_preferences;
CREATE TRIGGER np_touch BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Overdue events dedup log
CREATE TABLE IF NOT EXISTS public.overdue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, user_id, stage)
);

GRANT SELECT ON public.overdue_events TO authenticated;
GRANT ALL ON public.overdue_events TO service_role;

ALTER TABLE public.overdue_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overdue_events_admin_read" ON public.overdue_events;
CREATE POLICY "overdue_events_admin_read" ON public.overdue_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS overdue_events_task_idx ON public.overdue_events(task_id);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications(user_id, is_read, created_at DESC);
