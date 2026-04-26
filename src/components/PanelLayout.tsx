import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOrderNotifications, requestNotificationPermission } from "@/hooks/useOrderNotifications";
import { Button } from "@/components/ui/button";
import { LayoutGrid, ClipboardList, UtensilsCrossed, BarChart3, Settings, LogOut, Loader2, Bell, BellOff, Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function PanelLayout() {
  const { user, role, loading, signOut } = useAuth();
  const nav = useNavigate();
  const { pendingCount } = useOrderNotifications();
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | "unsupported">("default");

  useEffect(() => {
    if (!loading && !user) nav("/auth", { replace: true });
  }, [user, loading, nav]);

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setNotifPerm("unsupported");
    } else {
      setNotifPerm(Notification.permission);
    }
  }, []);

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin h-8 w-8 text-primary" />
    </div>
  );

  const links = [
    { to: "/painel/mesas",    icon: LayoutGrid,     label: "Mesas",          roles: ["admin", "garcom"] },
    { to: "/painel/online",   icon: ClipboardList,  label: "Pedidos online", roles: ["admin", "garcom"] },
    { to: "/admin/cardapio",  icon: UtensilsCrossed,label: "Cardápio",  roles: ["admin"] },
    { to: "/admin/relatorios",icon: BarChart3,       label: "Relatórios",roles: ["admin"] },
    { to: "/admin/config",    icon: Settings,        label: "Configurações", roles: ["admin"] },
    { to: "/admin/clientes",  icon: Users,           label: "Clientes",      roles: ["admin"] },
  ].filter((l) => role && l.roles.includes(role));

  const handleEnableNotif = async () => {
    const result = await requestNotificationPermission();
    setNotifPerm(result as NotificationPermission);
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/painel/mesas" className="pizza-title text-2xl text-primary">EXPRESSO</Link>
          <div className="flex items-center gap-2">
            {notifPerm === "default" && (
              <Button variant="outline" size="sm" onClick={handleEnableNotif}
                className="text-amber-600 border-amber-400 hover:bg-amber-50">
                <Bell className="h-4 w-4 mr-1" /> Ativar alertas
              </Button>
            )}
            {notifPerm === "denied" && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                <BellOff className="h-3 w-3" /> Notif. bloqueadas
              </span>
            )}
            <span className="hidden sm:inline text-xs text-muted-foreground">
              {user.email} &middot; {role}
            </span>
            <Button variant="outline" size="sm"
              onClick={async () => { await signOut(); nav("/auth"); }}>
              <LogOut className="h-4 w-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
        <nav className="container mx-auto px-2 overflow-x-auto">
          <div className="flex gap-1 pb-2 min-w-max">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to}
                className={({ isActive }) =>
                  `relative flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`
                }>
                <l.icon className="h-4 w-4" />
                {l.label}
                {l.to === "/painel/online" && pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-5 min-w-[20px] px-1 text-xs font-bold flex items-center justify-center animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
