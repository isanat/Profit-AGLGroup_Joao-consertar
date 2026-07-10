import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Briefcase,
  LineChart,
  Wallet,
  ArrowLeftRight,
  History,
  Users,
  Bell,
  User,
  Shield,
  HelpCircle,
  Settings,
  LogOut,
  Menu,
  TrendingUp,
  X,
  ChevronRight,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ModalProvider, useModal } from "@/lib/modal-context";
import { GlobalModals } from "@/components/global-modals";
import { useSiteConfig } from "@/lib/site-config";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModalProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
      <GlobalModals />
    </ModalProvider>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { openModal } = useModal();
  const { config: siteConfig } = useSiteConfig();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
        queryClient.clear();
      },
    });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/my-positions", label: "Minhas Posições", icon: Briefcase },
    { href: "/strategies", label: "Planos", icon: LineChart },
    { href: "/transactions", label: "Transações", icon: History },
    { href: "/referrals", label: "Indicações", icon: Users },
    { href: "/profile", label: "Perfil", icon: User },
    { href: "/support", label: "Suporte", icon: HelpCircle },
  ];

  const adminItems = [
    { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
    { href: "/admin/users", label: "Usuários", icon: Users },
    { href: "/admin/strategies", label: "Estratégias", icon: LineChart },
    { href: "/admin/deposits", label: "Depósitos", icon: Wallet },
    { href: "/admin/withdrawals", label: "Saques", icon: ArrowLeftRight },
    { href: "/admin/payment-invoices", label: "Faturas de Pagamento", icon: CreditCard },
    { href: "/admin/referrals", label: "Indicações", icon: Users },
    { href: "/admin/notifications", label: "Notificações", icon: Bell },
    { href: "/admin/audit-logs", label: "Logs de Auditoria", icon: History },
    { href: "/admin/settings", label: "Configurações", icon: Settings },
  ];

  // Bottom nav items (mobile only - most used 4)
  // "Depositar" abre modal (modal field) em vez de navegar para /deposit
  const bottomNavItems: { href: string; label: string; icon: any; modal?: "deposit" | "withdraw" | "notifications" }[] = [
    { href: "/dashboard", label: "Início", icon: LayoutDashboard },
    { href: "/strategies", label: "Planos", icon: LineChart },
    { href: "#", label: "Depositar", icon: Wallet, modal: "deposit" },
    { href: "/my-positions", label: "Posições", icon: Briefcase },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

  const initial = (user?.name ?? "U")[0].toUpperCase();

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-64 bg-card border-r border-border flex-shrink-0"
        style={{ borderRight: "1px solid rgba(245,158,11,0.15)" }}
      >
        <div className="p-5 flex items-center border-b" style={{ borderColor: "rgba(245,158,11,0.1)" }}>
          <img
            src={siteConfig?.siteLogoUrl || "/logo.png"}
            alt={siteConfig?.siteName || "Alliance Group"}
            className="h-14 w-auto"
            onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
          />
          <span className="ml-3 text-base font-bold text-amber-400 tracking-wide">
            {siteConfig?.siteName || "Alliance Group"}
          </span>
        </div>

        {/* User info */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #b45309, #f59e0b)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
              {isActive(item.href) && <ChevronRight className="ml-auto h-3 w-3 opacity-50" />}
            </Link>
          ))}

          {user?.role === "admin" && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-amber-400/60 uppercase tracking-wider">Admin</p>
              </div>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-amber-500/10 text-amber-400"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* ── Mobile slide-in menu ── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card flex-col md:hidden transition-transform duration-300 ${
          isMobileMenuOpen ? "flex translate-x-0" : "flex -translate-x-full"
        }`}
        style={{ borderRight: "1px solid rgba(245,158,11,0.2)" }}
      >
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: "rgba(245,158,11,0.1)" }}
        >
          <img
            src={siteConfig?.siteLogoUrl || "/logo.png"}
            alt={siteConfig?.siteName || "Alliance Group"}
            className="h-10 w-auto"
            onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
          />
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile user card */}
        <div className="mx-3 mt-3 mb-2 p-3 rounded-xl" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.15)" }}>
          <div className="flex items-center gap-3">
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #b45309, #f59e0b)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "16px",
                fontWeight: 800,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-amber-400/70">{user?.role === "admin" ? "Administrador" : "Investidor VIP"}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          ))}

          {user?.role === "admin" && (
            <>
              <div className="pt-4 pb-1">
                <p className="px-3 text-xs font-semibold text-amber-400/60 uppercase tracking-wider">Admin</p>
              </div>
              {adminItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-amber-500/10 text-amber-400"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            Sair da Conta
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Desktop header */}
        <header
          className="hidden md:flex items-center justify-between px-6 flex-shrink-0"
          style={{
            height: "64px",
            background: "#0B1120",
            borderBottom: "1px solid rgba(245,158,11,0.12)",
          }}
        >
          {/* Left: logo + site name */}
          <div className="flex items-center gap-3">
            <img
              src={siteConfig?.siteLogoUrl || "/logo.png"}
              alt={siteConfig?.siteName || "Alliance Group"}
              className="h-9 w-auto"
              onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
            />
            <span className="text-sm font-bold text-amber-400 tracking-wide">
              {siteConfig?.siteName || "Alliance Group"}
            </span>
          </div>

          {/* Right: notifications + profile */}
          <div className="flex items-center gap-3">
            <button
              className="p-2 rounded-lg text-muted-foreground hover:text-amber-400 hover:bg-amber-400/10 transition-colors relative"
              onClick={() => openModal("notifications")}
              title="Notificações"
            >
              <Bell className="h-5 w-5" />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400"
                style={{ display: "none" }}
              />
            </button>
            <Link href="/profile" className="flex items-center gap-2 p-1 pr-3 rounded-lg hover:bg-accent transition-colors">
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #b45309, #f59e0b)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {initial}
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-xs font-semibold leading-tight">{user?.name}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[120px]">{user?.email}</p>
              </div>
            </Link>
          </div>
        </header>

        {/* Mobile header */}
        <header
          className="md:hidden flex items-center justify-between px-4 flex-shrink-0"
          style={{
            height: "60px",
            background: "#0B1120",
            borderBottom: "1px solid rgba(245,158,11,0.12)",
          }}
        >
          <img
            src={siteConfig?.siteLogoUrl || "/logo.png"}
            alt={siteConfig?.siteName || "Alliance Group"}
            className="h-9 w-auto"
            onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }}
          />
          <div className="flex items-center gap-2">
            <button
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => openModal("notifications")}
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="p-4 sm:p-6 lg:p-8 md:pb-6 pb-24 max-w-screen-xl mx-auto">
            {children}
          </div>
        </div>

        {/* ── Mobile bottom navigation ── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center"
          style={{
            background: "#0B1120",
            borderTop: "1px solid rgba(245,158,11,0.15)",
            height: "64px",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {bottomNavItems.map((item) => {
            const active = isActive(item.href);
            const inner = (
              <>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: active ? "rgba(245,158,11,0.12)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <item.icon
                    style={{
                      width: "20px",
                      height: "20px",
                      color: active ? "#f59e0b" : "#64748b",
                      transition: "color 0.2s",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: active ? 700 : 500,
                    color: active ? "#f59e0b" : "#64748b",
                    lineHeight: 1,
                  }}
                >
                  {item.label}
                </span>
              </>
            );
            if (item.modal) {
              return (
                <button
                  key={item.label}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors"
                  onClick={() => openModal(item.modal as any)}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 transition-colors"
              >
                {inner}
              </Link>
            );
          })}
          {/* Menu button */}
          <button
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Menu style={{ width: "20px", height: "20px", color: "#64748b" }} />
            </div>
            <span style={{ fontSize: "10px", fontWeight: 500, color: "#64748b", lineHeight: 1 }}>
              Menu
            </span>
          </button>
        </nav>
      </main>
    </div>
  );
}
