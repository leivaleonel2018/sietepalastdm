import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { authAction } from "@/lib/api";

interface Player {
  id: string;
  full_name: string;
  dni: string;
  rating: number;
  avatar_url?: string | null;
}

interface AuthState {
  player: Player | null;
  isAdmin: boolean;
  adminToken: string | null;
  playerToken: string | null;
}

interface AuthContextType extends AuthState {
  loginPlayer: (dni: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  registerPlayer: (full_name: string, dni: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const saved = localStorage.getItem("tdm_auth");
    return saved ? JSON.parse(saved) : { player: null, isAdmin: false, adminToken: null, playerToken: null };
  });

  useEffect(() => {
    localStorage.setItem("tdm_auth", JSON.stringify(auth));
  }, [auth]);

  const loginPlayer = async (dni: string, password: string) => {
    try {
      const data = await authAction("login", { dni, password });
      if (data.error) return { success: false, error: data.error };
      setAuth({ player: data.player, isAdmin: false, adminToken: null, playerToken: data.token });
      return { success: true };
    } catch {
      return { success: false, error: "Error de conexión" };
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    try {
      const data = await authAction("admin_login", { username, password });
      if (data.error) return { success: false, error: data.error };
      setAuth({ player: null, isAdmin: true, adminToken: data.token, playerToken: null });
      return { success: true };
    } catch {
      return { success: false, error: "Error de conexión" };
    }
  };

  const registerPlayer = async (full_name: string, dni: string, password: string) => {
    try {
      const data = await authAction("register", { full_name, dni, password });
      if (data.error) return { success: false, error: data.error };
      setAuth({ player: data.player, isAdmin: false, adminToken: null, playerToken: data.token });
      return { success: true };
    } catch {
      return { success: false, error: "Error de conexión" };
    }
  };

  const logout = () => {
    setAuth({ player: null, isAdmin: false, adminToken: null, playerToken: null });
    localStorage.removeItem("tdm_auth");
  };

  return (
    <AuthContext.Provider value={{ ...auth, loginPlayer, loginAdmin, registerPlayer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
