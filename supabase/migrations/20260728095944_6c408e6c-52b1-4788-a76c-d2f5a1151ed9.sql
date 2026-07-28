
-- 1) Central visibility function
CREATE OR REPLACE FUNCTION public.can_view_task(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  ov_all text;
  ov_task text;
BEGIN
  IF _user_id IS NULL OR _task_id IS NULL THEN
    RETURN false;
  END IF;

  -- Explicit deny for this specific task always wins over ownership
  SELECT value INTO ov_task
  FROM public.user_permission_overrides
  WHERE user_id = _user_id AND permission_key = 'view_task:' || _task_id::text
  LIMIT 1;
  IF ov_task = 'deny' THEN RETURN false; END IF;
  IF ov_task = 'allow' THEN RETURN true; END IF;

  -- Full-view roles: Super Admin, Admin, Sales Manager, Design Manager
  IF public.has_any_role(_user_id, ARRAY[
      'super_admin'::app_role, 'admin'::app_role,
      'sales_manager'::app_role, 'design_manager'::app_role
  ]) THEN
    RETURN true;
  END IF;

  -- Global override: view all
  SELECT value INTO ov_all
  FROM public.user_permission_overrides
  WHERE user_id = _user_id AND permission_key = 'view_all_tasks'
  LIMIT 1;
  IF ov_all = 'allow' THEN RETURN true; END IF;
  IF ov_all = 'deny'  THEN RETURN false; END IF;

  -- Ownership: sales owner or assigned designer
  SELECT sales_owner_id, designer_id INTO t
  FROM public.tasks WHERE id = _task_id;
  IF t IS NULL THEN RETURN false; END IF;

  RETURN (t.sales_owner_id = _user_id) OR (t.designer_id = _user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.can_view_task(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_task(uuid, uuid) TO authenticated, service_role;

-- 2) tasks SELECT policy scoped to visibility
DROP POLICY IF EXISTS tasks_select_auth ON public.tasks;
CREATE POLICY tasks_select_scoped ON public.tasks
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.can_view_task(id, auth.uid()));

-- 3) task_activity — must be able to view the task to read its activity
DROP POLICY IF EXISTS activity_select ON public.task_activity;
CREATE POLICY activity_select_scoped ON public.task_activity
  FOR SELECT TO authenticated
  USING (task_id IS NULL OR public.can_view_task(task_id, auth.uid()));

-- 4) task_comments — read + insert gated by visibility
DROP POLICY IF EXISTS comments_select ON public.task_comments;
CREATE POLICY comments_select_scoped ON public.task_comments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));

DROP POLICY IF EXISTS comments_insert ON public.task_comments;
CREATE POLICY comments_insert_scoped ON public.task_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_view_task(task_id, auth.uid()));

-- 5) task_attachments — read + insert gated by visibility
DROP POLICY IF EXISTS attachments_select ON public.task_attachments;
CREATE POLICY attachments_select_scoped ON public.task_attachments
  FOR SELECT TO authenticated
  USING (public.can_view_task(task_id, auth.uid()));

DROP POLICY IF EXISTS attachments_insert ON public.task_attachments;
CREATE POLICY attachments_insert_scoped ON public.task_attachments
  FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid() AND public.can_view_task(task_id, auth.uid()));

-- 6) storage.objects for the task-files bucket
-- Path is 'tasks/<task_id>/<filename>' — extract task_id from position 2.
DROP POLICY IF EXISTS task_files_select ON storage.objects;
DROP POLICY IF EXISTS task_files_insert ON storage.objects;
DROP POLICY IF EXISTS task_files_update_own ON storage.objects;
DROP POLICY IF EXISTS task_files_delete_own_or_admin ON storage.objects;

CREATE POLICY task_files_select_scoped ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'task-files'
    AND (storage.foldername(name))[1] = 'tasks'
    AND public.can_view_task(
      NULLIF((storage.foldername(name))[2], '')::uuid,
      auth.uid()
    )
  );

CREATE POLICY task_files_insert_scoped ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-files'
    AND owner = auth.uid()
    AND (storage.foldername(name))[1] = 'tasks'
    AND public.can_view_task(
      NULLIF((storage.foldername(name))[2], '')::uuid,
      auth.uid()
    )
  );

CREATE POLICY task_files_update_own_scoped ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'task-files' AND owner = auth.uid()
    AND public.can_view_task(
      NULLIF((storage.foldername(name))[2], '')::uuid,
      auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'task-files' AND owner = auth.uid()
    AND public.can_view_task(
      NULLIF((storage.foldername(name))[2], '')::uuid,
      auth.uid()
    )
  );

CREATE POLICY task_files_delete_scoped ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'task-files'
    AND (
      owner = auth.uid()
      OR public.is_admin(auth.uid())
      OR public.has_any_role(auth.uid(), ARRAY['sales_manager'::app_role,'design_manager'::app_role])
    )
    AND public.can_view_task(
      NULLIF((storage.foldername(name))[2], '')::uuid,
      auth.uid()
    )
  );

-- 7) Helpful index for override lookups
CREATE INDEX IF NOT EXISTS user_permission_overrides_user_key_idx
  ON public.user_permission_overrides (user_id, permission_key);
