import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTaskFiles, recordTaskFile, signTaskFileUrl, deleteTaskFile } from "@/lib/tasks.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileIcon, Download, Trash2, Link2 } from "lucide-react";
import { formatDateTime } from "@/lib/format";

const KINDS = ["مرجع", "مبدئي", "تعديل", "مراجعة", "نهائية"] as const;

function bytes(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function extractPath(url: string) {
  // stored as "tasks/<task_id>/<filename>"
  return url;
}

export function FilesTab({
  taskId, nameById, canUpload, canDelete,
}: { taskId: string; nameById: Map<string, string | null>; canUpload: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTaskFiles);
  const recFn = useServerFn(recordTaskFile);
  const signFn = useServerFn(signTaskFileUrl);
  const delFn = useServerFn(deleteTaskFile);

  const { data: files = [] } = useQuery({
    queryKey: ["files", taskId], queryFn: () => listFn({ data: { task_id: taskId } }),
  });

  const [kind, setKind] = useState<string>("مرجع");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true); setProgress(10);
    const safe = file.name.replace(/[^\w.\-\u0600-\u06FF]/g, "_");
    const path = `tasks/${taskId}/${Date.now()}_${safe}`;
    const { error: upErr } = await supabase.storage.from("task-files").upload(path, file, {
      cacheControl: "3600", upsert: false,
    });
    setProgress(70);
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    try {
      await recFn({ data: {
        task_id: taskId, file_name: file.name, file_url: path, kind,
        file_size: file.size, mime_type: file.type || null,
      }});
      setProgress(100);
      toast.success("تم رفع الملف");
      qc.invalidateQueries({ queryKey: ["files", taskId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false); setTimeout(() => setProgress(0), 500);
    }
  };

  const onPick = () => inputRef.current?.click();
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) upload(f); e.target.value = "";
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0]; if (f && canUpload) upload(f);
  };

  const openFile = async (path: string) => {
    const r = await signFn({ data: { path, expires: 300 } });
    if (r?.signedUrl) window.open(r.signedUrl, "_blank");
  };
  const copyLink = async (path: string) => {
    const r = await signFn({ data: { path, expires: 3600 } });
    if (r?.signedUrl) { navigator.clipboard.writeText(r.signedUrl); toast.success("تم نسخ رابط مؤقت (ساعة)"); }
  };

  const del = useMutation({
    mutationFn: (row: any) => delFn({ data: { attachment_id: row.id, path: row.file_url } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["files", taskId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {canUpload && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          className="border-2 border-dashed rounded-lg p-6 text-center bg-secondary/30 hover:bg-secondary/50 transition"
        >
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <div className="text-sm mb-3">اسحب الملف هنا أو</div>
          <div className="flex items-center justify-center gap-2">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={onPick} disabled={uploading}>اختر ملفاً</Button>
            <input ref={inputRef} type="file" className="hidden" onChange={onChange} />
          </div>
          {uploading && <Progress value={progress} className="mt-3" />}
        </div>
      )}

      <div className="space-y-2">
        {files.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-6">لا توجد ملفات بعد</div>
        )}
        {files.map((f: any) => (
          <div key={f.id} className="flex items-center gap-3 rounded-lg border p-3">
            <FileIcon className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{f.file_name}</div>
              <div className="text-xs text-muted-foreground">
                {f.kind} · {bytes(f.file_size)} · {nameById.get(f.uploader_id) ?? "—"} · {formatDateTime(f.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => openFile(f.file_url)} title="فتح">
                <Download className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => copyLink(f.file_url)} title="نسخ الرابط">
                <Link2 className="h-4 w-4" />
              </Button>
              {canDelete && (
                <Button size="icon" variant="ghost" onClick={() => del.mutate(f)} title="حذف">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
