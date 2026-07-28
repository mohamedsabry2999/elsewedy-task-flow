import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandSplash } from "@/components/brand/BrandSplash";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexRedirect,
  pendingComponent: () => <BrandSplash label="جارٍ التحقق من الجلسة…" />,
});

function IndexRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return <BrandSplash label="جارٍ التحقق من الجلسة…" />;
}
