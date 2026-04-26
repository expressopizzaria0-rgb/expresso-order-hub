import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Senha de pelo menos 6 caracteres").max(100),
});

export default function Auth() {
  const { user, role, loading } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      nav(role === "admin" ? "/admin" : "/painel/mesas", { replace: true });
    }
  }, [user, role, loading, nav]);

  const handle = async () => {
    const p = schema.safeParse({ email, password });
    if (!p.success) { toast.error(p.error.issues[0].message); return; }
    setBusy(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/painel/mesas" },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já pode entrar.");
        setTab("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo!");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-6">
          <h1 className="pizza-title text-3xl text-primary">EXPRESSO</h1>
          <p className="text-sm text-muted-foreground">Painel interno</p>
        </div>
        <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>
          <TabsContent value="login" className="space-y-3 pt-4" />
          <TabsContent value="signup" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">O primeiro cadastro vira administrador. Os próximos viram garçons (admin pode promover depois).</p>
          </TabsContent>
        </Tabs>
        <div className="space-y-3 mt-2">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <Button onClick={handle} className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin h-4 w-4" /> : tab === "login" ? "Entrar" : "Criar conta"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => nav("/")}>Voltar ao cardápio</Button>
        </div>
      </Card>
    </div>
  );
}
