import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Users, ChevronRight, Trophy } from "lucide-react";
import { toast } from "sonner";

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  format: string;
  type: string;
  status: string;
  max_players: number | null;
  created_at: string;
}

const formatLabels: Record<string, string> = {
  single_elimination: "Eliminación Directa",
  groups: "Fase de Grupos",
  groups_then_elimination: "Grupos + Eliminación",
};

const statusConfig: Record<string, { label: string; class: string }> = {
  registration: { label: "Inscripción Abierta", class: "bg-primary/10 text-primary" },
  in_progress: { label: "🔴 En Curso", class: "bg-accent/20 text-accent-foreground" },
  finished: { label: "Finalizado", class: "bg-muted text-muted-foreground" },
};

export default function Tournaments() {
  const { player } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [tournamentsRes, regsRes] = await Promise.all([
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
      supabase.from("tournament_registrations").select("tournament_id, player_id"),
    ]);
    setTournaments(tournamentsRes.data || []);
    const regsMap: Record<string, string[]> = {};
    (regsRes.data || []).forEach(r => {
      if (!regsMap[r.tournament_id]) regsMap[r.tournament_id] = [];
      regsMap[r.tournament_id].push(r.player_id);
    });
    setRegistrations(regsMap);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleRegister = async (tournamentId: string) => {
    if (!player) { toast.error("Tenés que iniciar sesión para inscribirte"); return; }
    try {
      const data = await adminAction("register_player_tournament", { tournament_id: tournamentId, player_id: player.id }, "admin_token");
      if (data.error) { toast.error(data.error); } else { toast.success("¡Te inscribiste!"); fetchData(); }
    } catch { toast.error("Error al inscribirse"); }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden ping-pong-pattern">
      {/* Animated Nebula Background */}
      <div className="particles-bg">
        <div className="nebula-glow nebula-1"></div>
        <div className="nebula-glow nebula-2"></div>
        <div className="nebula-glow nebula-3"></div>
        <div className="dust-particles"></div>
      </div>

      <div className="relative z-10">
        <Navbar />
        <div className="container mx-auto px-4 py-10">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 flex items-center gap-2 animate-slide-up">
          <Trophy className="w-6 h-6 text-primary" /> Torneos
        </h1>

        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-1/2 mb-4" />
                <div className="h-8 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            No hay torneos creados aún.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map((t, i) => {
              const regs = registrations[t.id] || [];
              const isRegistered = player && regs.includes(player.id);
              const status = statusConfig[t.status] || statusConfig.registration;
              return (
                <div key={t.id} className="glass-card p-5 animate-slide-up hover:shadow-md transition-all duration-300" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-heading font-semibold text-foreground">{t.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.class}`}>
                      {status.label}
                    </span>
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mb-3">{t.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{formatLabels[t.format] || t.format}</span>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{t.type === "singles" ? "Individual" : "Dobles"}</span>
                    <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />{regs.length}{t.max_players ? `/${t.max_players}` : ""}
                    </span>
                  </div>
                  {t.status === "registration" && player && !isRegistered && (
                    <button onClick={() => handleRegister(t.id)} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all">
                      Inscribirme
                    </button>
                  )}
                  {isRegistered && (
                    <div className="w-full py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold text-center">✓ Inscripto</div>
                  )}
                  <Link to={`/torneo/${t.id}`} className="flex items-center justify-center gap-1 mt-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                    Ver detalles <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
