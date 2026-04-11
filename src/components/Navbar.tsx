import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Users, LogIn, LogOut, Shield, Menu, X, Swords, BookOpen } from "lucide-react";
import { useState } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";

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
    { to: "/reglas", label: "Reglas", icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <nav className="nav-dark sticky top-0 z-50 border-b border-border/10 backdrop-blur-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2 text-primary-foreground font-heading font-bold text-lg hover:opacity-90 transition-opacity">
            🏓 TDM
          </Link>

          <div className="hidden md:flex items-center gap-0.5">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? "bg-primary/20 text-primary-foreground"
                    : "text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/5"
                }`}
              >
                {link.icon}{link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to="/admin"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isActive("/admin")
                    ? "bg-primary/20 text-primary-foreground"
                    : "text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/5"
                }`}
              >
                <Shield className="w-4 h-4" />Admin
              </Link>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {player && (
              <Link to={`/jugador/${player.id}`} className="flex items-center gap-2 text-primary-foreground/50 text-sm hover:text-primary-foreground transition-colors">
                <PlayerAvatar name={player.full_name} avatarUrl={(player as any).avatar_url} size="xs" />
                {player.full_name} · <span className="font-semibold text-primary-foreground/80">{player.rating}</span>
              </Link>
            )}
            {(player || isAdmin) ? (
              <button
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-primary-foreground/50 hover:text-primary-foreground hover:bg-primary-foreground/5 transition-all"
              >
                <LogOut className="w-4 h-4" />Salir
              </button>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
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
          <div className="md:hidden pb-3 space-y-1 animate-slide-up">
            {/* Mobile: show player info */}
            {player && (
              <Link
                to={`/jugador/${player.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-3 rounded-lg bg-primary-foreground/5 mb-2"
              >
                <PlayerAvatar name={player.full_name} avatarUrl={(player as any).avatar_url} size="md" />
                <div>
                  <p className="text-sm font-semibold text-primary-foreground">{player.full_name}</p>
                  <p className="text-xs text-primary-foreground/60">Rating: <span className="font-bold text-primary-foreground/80">{player.rating}</span></p>
                </div>
              </Link>
            )}
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-primary-foreground/70 hover:bg-primary-foreground/5 text-sm"
              >
                {link.icon}{link.label}
              </Link>
            ))}
            {isAdmin && (
              <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-primary-foreground/70 text-sm">
                <Shield className="w-4 h-4" />Admin
              </Link>
            )}
            {(player || isAdmin) ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-primary-foreground/70 text-sm w-full">
                <LogOut className="w-4 h-4" />Salir
              </button>
            ) : (
              <Link to="/login" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-primary-foreground/70 text-sm">
                <LogIn className="w-4 h-4" />Ingresar
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
