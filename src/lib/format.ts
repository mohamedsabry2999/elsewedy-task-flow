const dtDate = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo",
  year: "numeric", month: "short", day: "2-digit",
});
const dtDateTime = new Intl.DateTimeFormat("ar-EG", {
  timeZone: "Africa/Cairo",
  year: "numeric", month: "short", day: "2-digit",
  hour: "numeric", minute: "2-digit", hour12: true,
});

export const formatDate = (v?: string | null) => (v ? dtDate.format(new Date(v)) : "—");
export const formatDateTime = (v?: string | null) => (v ? dtDateTime.format(new Date(v)) : "—");

/** Format "HH:MM" or "HH:MM:SS" as Arabic 12-hour ص/م. */
export const formatTime12 = (t?: string | null) => {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr); const m = Number(mStr ?? "0");
  if (!Number.isFinite(h)) return "—";
  const period = h >= 12 ? "م" : "ص";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

/** Combined "date • time" formatter (Cairo). */
export const formatDueDateTime = (d?: string | null, t?: string | null) => {
  if (!d) return "—";
  return `${formatDate(d)}${t ? ` • ${formatTime12(t)}` : ""}`;
};

export const isOverdue = (due?: string | null, delivered?: boolean) => {
  if (!due || delivered) return false;
  const now = new Date();
  const d = new Date(due);
  return d.getTime() < now.setHours(0, 0, 0, 0);
};

export function toCSV(rows: Record<string, unknown>[], headers: { key: string; label: string }[]) {
  const escape = (v: unknown) => {
    if (v == null) return "";
    const s = Array.isArray(v) ? v.join("، ") : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const head = headers.map((h) => escape(h.label)).join(",");
  const body = rows.map((r) => headers.map((h) => escape(r[h.key])).join(",")).join("\n");
  // BOM for Excel Arabic
  return "\uFEFF" + head + "\n" + body;
}

export function downloadCSV(name: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
