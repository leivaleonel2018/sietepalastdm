import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Users, LogIn, LogOut, Shield, Menu, X } from "lucide-react";
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
  ];

  return (
    <nav className="gradient-primary sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-primary-foreground font-heading font-bold text-xl">
            🏓 TDM Siete Palmas
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                }`}
              >
                {link.icon}{link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive("/admin")
                    ? "bg-secondary/30 text-secondary"
                    : "text-secondary/80 hover:text-secondary hover:bg-secondary/10"
                }`}
              >
                <Shield className="w-4 h-4" />Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {player && (
              <span className="text-primary-foreground/80 text-sm">
                {player.full_name} ({player.rating} pts)
              </span>
            )}
            {(player || isAdmin) ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 transition-all"
              >
                <LogOut className="w-4 h-4" />Salir
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium gradient-accent text-accent-foreground hover:opacity-90 transition-all"
              >
                <LogIn className="w-4 h-4" />Ingresar
              </Link>
            )}
          </div>

          <button className="md:hidden text-primary-foreground" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-primary-foreground/80 hover:bg-primary-foreground/10"
              >
                {link.icon}{link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary">
                <Shield className="w-4 h-4" />Admin
              </Link>
            )}
            {(player || isAdmin) ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 rounded-lg text-primary-foreground/80">
                <LogOut className="w-4 h-4" />Salir
              </button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-secondary">
                <LogIn className="w-4 h-4" />Ingresar
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
