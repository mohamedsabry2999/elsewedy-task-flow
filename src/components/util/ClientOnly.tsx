import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders `children` only after the client has hydrated.
 * Use to isolate components whose first client render differs from server
 * output (portals, locale-dependent formatting, Supabase session lookups),
 * which is a common cause of React error #418 in production.
 */
export function ClientOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
