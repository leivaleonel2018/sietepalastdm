import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Trophy, Users } from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  format: string;
  type: string;
  status: string;
  max_players: number | null;
  groups_count: number | null;
}

interface Registration {
  player_id: string;
  players: { full_name: string; rating: number } | null;
}

interface Match {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  round: string | null;
  group_name: string | null;
  rating_change_p1: number | null;
  rating_change_p2: number | null;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    
    const fetchAll = async () => {
      const [tRes, rRes, mRes] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", id).single(),
        supabase.from("tournament_registrations").select("player_id, players(full_name, rating)").eq("tournament_id", id),
        supabase.from("matches").select("*").eq("tournament_id", id).order("match_order"),
      ]);
      
      setTournament(tRes.data as Tournament | null);
      setRegistrations((rRes.data || []) as unknown as Registration[]);
      setMatches(mRes.data || []);

      // Build player name map
      const pMap: Record<string, string> = {};
      (rRes.data || []).forEach((r: any) => {
        if (r.players) pMap[r.player_id] = r.players.full_name;
      });
      setPlayersMap(pMap);
      setLoading(false);
    };
    fetchAll();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Cargando...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Torneo no encontrado.</div>
      </div>
    );
  }

  const formatLabels: Record<string, string> = {
    single_elimination: "Eliminación Directa",
    groups: "Fase de Grupos",
    groups_then_elimination: "Grupos + Eliminación",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2">{tournament.name}</h1>
          {tournament.description && <p className="text-muted-foreground">{tournament.description}</p>}
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-medium">
              {formatLabels[tournament.format] || tournament.format}
            </span>
            <span className="text-xs px-2 py-1 rounded-md bg-secondary/10 text-secondary font-medium">
              {tournament.type === "singles" ? "Individual" : "Dobles"}
            </span>
            <span className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground">
              {tournament.status === "registration" ? "Inscripción Abierta" : tournament.status === "in_progress" ? "En Curso" : "Finalizado"}
            </span>
          </div>
        </div>

        {/* Registered Players */}
        <div className="glass-card p-5 mb-6">
          <h2 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Jugadores Inscriptos ({registrations.length})
          </h2>
          {registrations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay jugadores inscriptos aún.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {registrations.map(r => (
                <div key={r.player_id} className="px-3 py-2 rounded-lg bg-muted/50 text-sm">
                  <span className="font-medium text-foreground">{r.players?.full_name}</span>
                  <span className="text-muted-foreground ml-1">({r.players?.rating})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Matches */}
        {matches.length > 0 && (
          <div className="glass-card p-5">
            <h2 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-secondary" /> Partidos
            </h2>
            <div className="space-y-2">
              {matches.map(m => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    {m.group_name && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{m.group_name}</span>}
                    {m.round && <span className="text-xs px-2 py-0.5 rounded bg-secondary/10 text-secondary">{m.round}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className={m.winner_id === m.player1_id ? "font-bold text-success" : "text-foreground"}>
                      {playersMap[m.player1_id || ""] || "TBD"}
                    </span>
                    <span className="font-heading font-bold text-foreground">
                      {m.player1_score ?? "-"} : {m.player2_score ?? "-"}
                    </span>
                    <span className={m.winner_id === m.player2_id ? "font-bold text-success" : "text-foreground"}>
                      {playersMap[m.player2_id || ""] || "TBD"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
