import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, Users, LogIn, LogOut, Shield, Menu, X, Swords, BookOpen, Home, Newspaper, Bell } from "lucide-react";
import { useState, useEffect } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Navbar() {
  const { player, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingChallenges, setPendingChallenges] = useState(0);

  useEffect(() => {
    if (!player) return;

    // Initial fetch of pending challenges
    supabase
      .from("challenges")
      .select("id", { count: "exact", head: true })
      .eq("challenged_id", player.id)
      .eq("status", "pending")
      .then(({ count }) => {
        if (count !== null) setPendingChallenges(count);
      });

    // Listen to Challenges where challenged_id = player.id
    const channel = supabase.channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'challenges', filter: `challenged_id=eq.${player.id}` },
        (payload) => {
          setNotifications(prev => ["¡Te han desafiado a un partido!", ...prev]);
          toast("¡Nuevo desafío!", { description: "Revisa tu sección de desafíos." });
          setPendingChallenges(p => p + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'challenges', filter: `challenged_id=eq.${player.id}` },
        () => {
          // Re-fetch on updates (e.g. accepted/declined)
          supabase.from("challenges").select("id", { count: "exact", head: true }).eq("challenged_id", player.id).eq("status", "pending")
            .then(({ count }) => setPendingChallenges(count || 0));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'news' },
        (payload: any) => {
          setNotifications(prev => [`Nueva noticia: ${payload.new.title}`, ...prev]);
          toast("Noticia publicada", { description: payload.new.title });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [player]);

  // Dynamic Favicon Effect
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    if (pendingChallenges > 0) {
      // Red glowing ping pong ball (alert state)
      link.href = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23ef4444"/><path d="M 30 50 Q 50 30 70 50" stroke="white" stroke-width="5" fill="none" opacity="0.6"/><circle cx="50" cy="50" r="40" fill="none" stroke="%23fca5a5" stroke-width="4"><animate attributeName="r" values="40;45;40" dur="1.5s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite" /></circle></svg>`;
      document.title = `(${pendingChallenges}) ¡Desafío Pendiente! | TDM`;
    } else {
      // Default orange ping pong ball
      link.href = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%23f97316"/><path d="M 30 50 Q 50 30 70 50" stroke="white" stroke-width="5" fill="none" opacity="0.4"/></svg>`;
      document.title = "TDM Siete Palmas";
    }
  }, [pendingChallenges]);

  const isActive = (path: string) => location.pathname === path;

  const navLinks = [
    { to: "/", label: "Inicio", icon: <Home className="w-4 h-4" /> },
    { to: "/rankings", label: "Rankings", icon: <Users className="w-4 h-4" /> },
    { to: "/torneos", label: "Torneos", icon: <Trophy className="w-4 h-4" /> },
    { to: "/desafios", label: "Desafíos", icon: <Swords className="w-4 h-4" /> },
    { to: "/reglas", label: "Reglas", icon: <BookOpen className="w-4 h-4" /> },
    { to: "/noticias", label: "Noticias", icon: <Newspaper className="w-4 h-4" /> },
  ];

  return (
    <>
      <nav className="nav-dark sticky top-0 z-50 border-b border-border/10 backdrop-blur-md">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 text-foreground font-heading font-bold text-lg hover:opacity-90 transition-opacity">
              🏓 TDM
            </Link>

            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive(link.to)
                      ? "bg-primary/20 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    }`}
                >
                  {link.icon}{link.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${isActive("/admin")
                      ? "bg-primary/20 text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    }`}
                >
                  <Shield className="w-4 h-4" />Admin
                </Link>
              )}
            </div>

            <div className="hidden md:flex items-center gap-3">
              {/* Notifications Bell */}
              {player && (
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors relative"
                  >
                    <Bell className="w-5 h-5" />
                    {notifications.length > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent animate-pulse-glow" />
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-64 bg-card border border-border shadow-2xl rounded-xl overflow-hidden z-50">
                      <div className="p-3 bg-primary/10 border-b border-border/50 flex items-center justify-between">
                        <span className="text-sm font-bold font-heading">Notificaciones</span>
                        {notifications.length > 0 && (
                          <button onClick={() => setNotifications([])} className="text-xs text-primary hover:underline">Limpiar</button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto p-2">
                        {notifications.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground text-sm">No hay notificaciones</div>
                        ) : (
                          notifications.map((n, i) => (
                            <div key={i} className="p-2.5 text-sm hover:bg-white/5 rounded-lg mb-1 last:mb-0 transition-colors text-foreground">
                              {n}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {player && (
                <Link to={`/jugador/${player.id}`} className="flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground transition-colors">
                  <PlayerAvatar name={player.full_name} avatarUrl={player.avatar_url} size="xs" />
                  {player.full_name} · <span className="font-semibold text-foreground/80">{player.rating}</span>
                </Link>
              )}
              {(player || isAdmin) ? (
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-all"
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

          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation - rendered outside nav to avoid stacking context issues */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-background/95 backdrop-blur-xl border-t border-border/20 flex justify-around items-center h-[72px] pb-safe px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
        {navLinks.slice(0, 4).map(link => (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setMenuOpen(false)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${isActive(link.to)
                ? "text-primary -translate-y-1"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            <div className={`p-1.5 rounded-full transition-colors ${isActive(link.to) ? "bg-primary/20" : "bg-transparent"}`}>
              {link.icon}
            </div>
            <span className="text-[10px] font-bold tracking-wide">{link.label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${menuOpen ? "text-primary -translate-y-1" : "text-muted-foreground hover:text-foreground"}`}
        >
          <div className={`p-1.5 rounded-full transition-colors ${menuOpen ? "bg-primary/20" : "bg-transparent"}`}>
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </div>
          <span className="text-[10px] font-bold tracking-wide">{menuOpen ? "Cerrar" : "Más"}</span>
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[55] animate-in fade-in duration-300"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Expanded */}
      {menuOpen && (
        <div className="md:hidden fixed bottom-[72px] left-0 right-0 bg-background/98 backdrop-blur-2xl border-t border-border/20 p-5 rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.6)] z-[58] animate-slide-up flex flex-col gap-4">
          <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full mx-auto mb-2" />

          {/* Mobile: show player info */}
          {player && (
            <Link
              to={`/jugador/${player.id}`}
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-4 px-4 py-4 rounded-3xl bg-muted/30 border border-border/10 mb-2"
            >
              <PlayerAvatar name={player.full_name} avatarUrl={player.avatar_url} size="md" />
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{player.full_name}</p>
                <p className="text-xs text-muted-foreground">Rating: <span className="font-bold text-primary">{player.rating}</span></p>
              </div>
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Extra links not in bottom bar */}
            {navLinks.slice(4).map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/20 border border-border/5 hover:bg-primary/10 hover:border-primary/20 transition-all"
              >
                <div className="p-2 rounded-2xl bg-primary/5 text-primary">
                  {link.icon}
                </div>
                <span className="text-xs font-bold text-foreground">{link.label}</span>
              </Link>
            ))}

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-3xl bg-muted/20 border border-border/5 hover:bg-primary/10 hover:border-primary/20 transition-all"
              >
                <div className="p-2 rounded-2xl bg-primary/5 text-primary">
                  <Shield className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-foreground">Admin</span>
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-2 mt-2">
            {(player || isAdmin) ? (
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-3xl bg-destructive/10 text-destructive border border-destructive/20 text-sm font-bold w-full transition-all hover:bg-destructive hover:text-white"
              >
                <LogOut className="w-4 h-4" /> Cerrar Sesión
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-3xl bg-primary text-white text-sm font-bold w-full shadow-lg shadow-primary/25 transition-all active:scale-95"
              >
                <LogIn className="w-4 h-4" /> Ingresar a la App
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
