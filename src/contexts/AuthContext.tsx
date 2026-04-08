import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Player {
  id: string;
  full_name: string;
  dni: string;
  rating: number;
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

  const invokeFunction = async (name: string, body: Record<string, unknown>) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/${name}`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const loginPlayer = async (dni: string, password: string) => {
    try {
      const data = await invokeFunction("auth", { action: "login", dni, password });
      if (data.error) return { success: false, error: data.error };
      setAuth({ player: data.player, isAdmin: false, adminToken: null, playerToken: data.token });
      return { success: true };
    } catch {
      return { success: false, error: "Error de conexión" };
    }
  };

  const loginAdmin = async (username: string, password: string) => {
    try {
      const data = await invokeFunction("auth", { action: "admin_login", username, password });
      if (data.error) return { success: false, error: data.error };
      setAuth({ player: null, isAdmin: true, adminToken: data.token, playerToken: null });
      return { success: true };
    } catch {
      return { success: false, error: "Error de conexión" };
    }
  };

  const registerPlayer = async (full_name: string, dni: string, password: string) => {
    try {
      const data = await invokeFunction("auth", { action: "register", full_name, dni, password });
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
