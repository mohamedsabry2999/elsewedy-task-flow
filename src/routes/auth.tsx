import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapFirstAdmin, hasAnySuperAdmin } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — Elsewedy Task Flow" },
      { name: "description", content: "تسجيل الدخول لمنصة مهام دار السويدي" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [fullName, setFullName] = useState("");

  const hasAdminFn = useServerFn(hasAnySuperAdmin);
  const bootFn = useServerFn(bootstrapFirstAdmin);
  const { data: bootstrap } = useQuery({ queryKey: ["has-admin"], queryFn: () => hasAdminFn() });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
  }, [navigate]);

  useEffect(() => { if (bootstrap && !bootstrap.exists) setSetupMode(true); }, [bootstrap]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (setupMode) {
        await bootFn({ data: { email, password, full_name: fullName } });
        toast.success("تم إنشاء حساب السوبر أدمن");
        setSetupMode(false);
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("مرحباً بك");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-secondary/50" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="mx-auto h-14 w-14 rounded-2xl brand-gradient flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            E
          </div>
          <h1 className="mt-4 text-2xl font-bold">Elsewedy Task Flow</h1>
          <p className="text-sm text-muted-foreground">دار السويدي للطباعة — منصة مهام السيلز والتصميم</p>
        </div>

        <Card className="card-elev">
          <CardHeader>
            <CardTitle>{setupMode ? "إعداد أول حساب سوبر أدمن" : "تسجيل الدخول"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {setupMode && (
                <div className="space-y-2">
                  <Label>الاسم الكامل</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "جارٍ..." : setupMode ? "إنشاء الحساب ودخول" : "دخول"}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                التسجيل الذاتي مغلق. للحصول على حساب، تواصل مع المسؤول.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">العودة للرئيسية</Link>
        </p>
      </div>
    </div>
  );
}
