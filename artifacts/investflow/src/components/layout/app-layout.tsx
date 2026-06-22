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
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const logoutMutation = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        logout();
        queryClient.clear();
      }
    });
  };

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/my-positions", label: "Minhas Posições", icon: Briefcase },
    { href: "/strategies", label: "Estratégias", icon: LineChart },
    { href: "/deposit", label: "Depositar", icon: Wallet },
    { href: "/withdraw", label: "Sacar", icon: ArrowLeftRight },
    { href: "/transactions", label: "Transações", icon: History },
    { href: "/referrals", label: "Indicações", icon: Users },
    { href: "/notifications", label: "Notificações", icon: Bell },
    { href: "/profile", label: "Perfil", icon: User },
    { href: "/security", label: "Segurança", icon: Shield },
    { href: "/support", label: "Suporte", icon: HelpCircle },
  ];

  const adminItems = [
    { href: "/admin", label: "Dashboard Admin", icon: LayoutDashboard },
    { href: "/admin/users", label: "Usuários", icon: Users },
    { href: "/admin/strategies", label: "Estratégias", icon: LineChart },
    { href: "/admin/daily-profit", label: "Distribuir Lucro Diário", icon: TrendingUp },
    { href: "/admin/deposits", label: "Depósitos", icon: Wallet },
    { href: "/admin/withdrawals", label: "Saques", icon: ArrowLeftRight },
    { href: "/admin/wallets", label: "Carteiras", icon: Wallet },
    { href: "/admin/referrals", label: "Indicações", icon: Users },
    { href: "/admin/password-resets", label: "Reset de Senha", icon: KeyRound },
    { href: "/admin/notifications", label: "Notificações", icon: Bell },
    { href: "/admin/audit-logs", label: "Logs de Auditoria", icon: History },
    { href: "/admin/settings", label: "Configurações", icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === "/admin") return location === "/admin";
    return location.startsWith(href);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform transform ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center">
            <img src="/logo.png" alt="Alliance Group" className="h-14 w-auto" />
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}

            {user?.role === "admin" && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
                </div>
                {adminItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.href) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-border">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-card border-b border-border md:hidden">
          <img src="/logo.png" alt="Alliance Group" className="h-9 w-auto" />
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
        </header>
        
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
