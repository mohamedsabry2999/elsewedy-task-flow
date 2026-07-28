import { BrandMark } from "./BrandMark";

export function BrandSplash({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-secondary/40" dir="rtl">
      <BrandMark size="xl" priority />
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span>{label}</span>
      </div>
    </div>
  );
}
