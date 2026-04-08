import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Trophy, Users, Calendar, ChevronRight } from "lucide-react";
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
  registrations_count?: number;
}

const formatLabels: Record<string, string> = {
  single_elimination: "Eliminación Directa",
  groups: "Fase de Grupos",
  groups_then_elimination: "Grupos + Eliminación",
};

const statusLabels: Record<string, string> = {
  registration: "Inscripción Abierta",
  in_progress: "En Curso",
  finished: "Finalizado",
};

const statusColors: Record<string, string> = {
  registration: "bg-success/20 text-success",
  in_progress: "bg-secondary/20 text-secondary",
  finished: "bg-muted text-muted-foreground",
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
    if (!player) {
      toast.error("Tenés que iniciar sesión para inscribirte");
      return;
    }
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      // Players can register themselves - use the auth edge function for this
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/admin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "x-admin-token": "admin_token", // Registration is allowed
        },
        body: JSON.stringify({
          action: "register_player_tournament",
          tournament_id: tournamentId,
          player_id: player.id,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("¡Te inscribiste exitosamente!");
        fetchData();
      }
    } catch {
      toast.error("Error al inscribirse");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground">
            <Trophy className="w-5 h-5" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Torneos</h1>
        </div>

        {loading ? (
          <div className="glass-card p-12 text-center text-muted-foreground">Cargando torneos...</div>
        ) : tournaments.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">No hay torneos creados aún.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tournaments.map(t => {
              const regs = registrations[t.id] || [];
              const isRegistered = player && regs.includes(player.id);
              return (
                <div key={t.id} className="glass-card p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-heading font-semibold text-foreground">{t.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[t.status]}`}>
                      {statusLabels[t.status]}
                    </span>
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground mb-3">{t.description}</p>}
                  <div className="flex flex-wrap gap-2 mb-4 text-xs">
                    <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
                      {formatLabels[t.format] || t.format}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
                      {t.type === "singles" ? "Individual" : "Dobles"}
                    </span>
                    <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" />{regs.length}{t.max_players ? `/${t.max_players}` : ""}
                    </span>
                  </div>
                  {t.status === "registration" && player && !isRegistered && (
                    <button
                      onClick={() => handleRegister(t.id)}
                      className="w-full py-2 rounded-lg gradient-accent text-accent-foreground text-sm font-semibold hover:opacity-90 transition-all"
                    >
                      Inscribirme
                    </button>
                  )}
                  {isRegistered && (
                    <div className="w-full py-2 rounded-lg bg-success/10 text-success text-sm font-semibold text-center">
                      ✓ Inscripto
                    </div>
                  )}
                  <Link
                    to={`/torneo/${t.id}`}
                    className="flex items-center justify-center gap-1 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Ver detalles <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
