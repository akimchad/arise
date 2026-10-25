import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokenStore } from "./api";
import type { User } from "./schemas";

type AuthState = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, name: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!tokenStore.get()) { setReady(true); return; }
    api.me()
      .then((r) => setUser(r.user))
      .catch(() => tokenStore.clear())
      .finally(() => setReady(true));
  }, []);

  const finish = useCallback(async (token: string, u: User) => {
    tokenStore.set(token);
    setUser(u);
    await api.claim().catch(() => undefined); // brands analyzed before signing in become yours
    return u;
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    ready,
    login: async (email, password) => {
      const r = await api.login(email, password);
      return finish(r.token, r.user);
    },
    signup: async (email, password, name) => {
      const r = await api.signup(email, password, name);
      return finish(r.token, r.user);
    },
    logout: () => { tokenStore.clear(); setUser(null); },
  }), [user, ready, finish]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
