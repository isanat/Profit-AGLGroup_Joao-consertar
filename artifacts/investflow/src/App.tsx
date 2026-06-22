import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/app-layout";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { getSmartAccessToken } from "@/lib/auth";

import Login from "@/pages/auth/login";
import Register from "@/pages/auth/register";
import ForgotPassword from "@/pages/auth/forgot-password";
import ResetPassword from "@/pages/auth/reset-password";
import VerifyEmail from "@/pages/auth/verify-email";

import Dashboard from "@/pages/dashboard";
import MyPositions from "@/pages/my-positions";
import Strategies from "@/pages/strategies/index";
import StrategyDetail from "@/pages/strategies/detail";
import Deposit from "@/pages/deposit";
import Withdraw from "@/pages/withdraw";
import Transactions from "@/pages/transactions";
import Referrals from "@/pages/referrals";
import Notifications from "@/pages/notifications";
import Profile from "@/pages/profile";
import Security from "@/pages/security";
import Support from "@/pages/support";

import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminStrategies from "@/pages/admin/strategies";
import AdminStrategyDetail from "@/pages/admin/strategy-detail";
import AdminDeposits from "@/pages/admin/deposits";
import AdminWithdrawals from "@/pages/admin/withdrawals";
import AdminWallets from "@/pages/admin/wallets";
import AdminNotifications from "@/pages/admin/notifications";
import AdminSettings from "@/pages/admin/settings";
import AdminAuditLogs from "@/pages/admin/audit-logs";
import AdminDailyProfit from "@/pages/admin/daily-profit";

import NotFound from "@/pages/not-found";

// Setup smart token getter — transparently refreshes when token is near expiry
setAuthTokenGetter(getSmartAccessToken);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component, requireAdmin = false }: { component: React.ComponentType, requireAdmin?: boolean }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-background"><p>Carregando...</p></div>;
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }

  if (requireAdmin && user.role !== "admin") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AppLayout>
      {requireAdmin ? (
        <div data-admin="true" className="contents">
          <Component />
        </div>
      ) : (
        <Component />
      )}
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public Auth Routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/verify-email" component={VerifyEmail} />
      
      {/* Protected Routes */}
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/my-positions" component={() => <ProtectedRoute component={MyPositions} />} />
      <Route path="/strategies" component={() => <ProtectedRoute component={Strategies} />} />
      <Route path="/strategies/:id" component={() => <ProtectedRoute component={StrategyDetail} />} />
      <Route path="/deposit" component={() => <ProtectedRoute component={Deposit} />} />
      <Route path="/withdraw" component={() => <ProtectedRoute component={Withdraw} />} />
      <Route path="/transactions" component={() => <ProtectedRoute component={Transactions} />} />
      <Route path="/referrals" component={() => <ProtectedRoute component={Referrals} />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route path="/security" component={() => <ProtectedRoute component={Security} />} />
      <Route path="/support" component={() => <ProtectedRoute component={Support} />} />

      {/* Admin Routes */}
      <Route path="/admin" component={() => <ProtectedRoute component={AdminDashboard} requireAdmin={true} />} />
      <Route path="/admin/users" component={() => <ProtectedRoute component={AdminUsers} requireAdmin={true} />} />
      <Route path="/admin/strategies" component={() => <ProtectedRoute component={AdminStrategies} requireAdmin={true} />} />
      <Route path="/admin/strategies/:id" component={() => <ProtectedRoute component={AdminStrategyDetail} requireAdmin={true} />} />
      <Route path="/admin/deposits" component={() => <ProtectedRoute component={AdminDeposits} requireAdmin={true} />} />
      <Route path="/admin/withdrawals" component={() => <ProtectedRoute component={AdminWithdrawals} requireAdmin={true} />} />
      <Route path="/admin/wallets" component={() => <ProtectedRoute component={AdminWallets} requireAdmin={true} />} />
      <Route path="/admin/notifications" component={() => <ProtectedRoute component={AdminNotifications} requireAdmin={true} />} />
      <Route path="/admin/settings" component={() => <ProtectedRoute component={AdminSettings} requireAdmin={true} />} />
      <Route path="/admin/audit-logs" component={() => <ProtectedRoute component={AdminAuditLogs} requireAdmin={true} />} />
      <Route path="/admin/daily-profit" component={() => <ProtectedRoute component={AdminDailyProfit} requireAdmin={true} />} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
