import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Users, LogIn, LogOut, Shield, Menu, X, Swords } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { player, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { to: "/", label: "Inicio", icon: null },
    { to: "/rankings", label: "Rankings", icon: <Users className="w-4 h-4" /> },
    { to: "/torneos", label: "Torneos", icon: <Trophy className="w-4 h-4" /> },
    { to: "/desafios", label: "Desafíos", icon: <Swords className="w-4 h-4" /> },
  ];

  return (
    <nav className="nav-dark sticky top-0 z-50 border-b border-border/20">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 text-primary-foreground font-heading font-bold text-lg">
            🏓 TDM Siete Palmas
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                }`}
              >
                {link.icon}{link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  isActive("/admin")
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10"
                }`}
              >
                <Shield className="w-4 h-4" />Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {player && (
              <Link to={`/jugador/${player.id}`} className="text-primary-foreground/60 text-sm hover:text-primary-foreground transition-colors">
                {player.full_name} · {player.rating} pts
              </Link>
            )}
            {(player || isAdmin) ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-primary-foreground/60 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-all"
              >
                <LogOut className="w-4 h-4" />Salir
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-primary-foreground text-primary hover:bg-primary-foreground/90 transition-all"
              >
                <LogIn className="w-4 h-4" />Ingresar
              </Link>
            )}
          </div>

          <button className="md:hidden text-primary-foreground/80" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-3 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-primary-foreground/70 hover:bg-primary-foreground/10 text-sm"
              >
                {link.icon}{link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-primary-foreground/70 text-sm">
                <Shield className="w-4 h-4" />Admin
              </Link>
            )}
            {(player || isAdmin) ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-md text-primary-foreground/70 text-sm w-full">
                <LogOut className="w-4 h-4" />Salir
              </button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-md text-primary-foreground/70 text-sm">
                <LogIn className="w-4 h-4" />Ingresar
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
