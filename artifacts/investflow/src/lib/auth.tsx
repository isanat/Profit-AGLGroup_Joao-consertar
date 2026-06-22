import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, type UserProfile } from "@workspace/api-client-react";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ---------------------------------------------------------------------------
// Smart token getter with proactive refresh (runs outside React)
// ---------------------------------------------------------------------------

let _refreshLock: Promise<string | null> | null = null;

function isTokenExpiringSoon(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    if (typeof payload.exp !== "number") return false;
    // Refresh proactively if less than 90 seconds remain
    return payload.exp * 1000 - Date.now() < 90_000;
  } catch {
    return false;
  }
}

/**
 * Async token getter registered with customFetch via setAuthTokenGetter().
 * Returns a valid access token, refreshing it transparently when needed.
 * Uses a shared lock so concurrent requests don't trigger multiple refreshes.
 */
export async function getSmartAccessToken(): Promise<string | null> {
  const accessToken = localStorage.getItem("accessToken");
  if (!accessToken) return null;

  if (!isTokenExpiringSoon(accessToken)) return accessToken;

  // Token expired or expiring soon — attempt refresh (only once at a time)
  if (_refreshLock) return _refreshLock;

  _refreshLock = (async (): Promise<string | null> => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        localStorage.removeItem("accessToken");
        return null;
      }

      const resp = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (!resp.ok) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return null;
      }

      const data = (await resp.json()) as { accessToken: string; refreshToken: string };
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      _refreshLock = null;
    }
  })();

  return _refreshLock;
}

// ---------------------------------------------------------------------------
// Auth context
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState<boolean>(!!localStorage.getItem("accessToken"));

  const {
    data: user,
    isLoading,
    isError,
  } = useGetMe({
    query: {
      enabled: hasToken,
      retry: false,
    } as any,
  });

  useEffect(() => {
    if (isError) {
      // Token refresh already cleared localStorage — just sync state
      logout();
    }
  }, [isError]);

  const login = (newToken: string, newRefreshToken: string) => {
    localStorage.setItem("accessToken", newToken);
    localStorage.setItem("refreshToken", newRefreshToken);
    setHasToken(true);
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    setHasToken(false);
  };

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
