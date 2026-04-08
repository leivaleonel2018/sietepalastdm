import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Users, ArrowLeft } from "lucide-react";

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
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Cargando...</div></div>;
  }
  if (!tournament) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Torneo no encontrado.</div></div>;
  }

  const formatLabels: Record<string, string> = {
    single_elimination: "Eliminación Directa",
    groups: "Fase de Grupos",
    groups_then_elimination: "Grupos + Eliminación",
  };

  // Group matches by round for bracket display
  const roundOrder = ["128vos", "64vos", "32vos", "16vos", "Octavos", "Cuartos", "Semifinal", "Final"];
  const matchesByRound: Record<string, Match[]> = {};
  matches.forEach(m => {
    const key = m.group_name || m.round || "Sin ronda";
    if (!matchesByRound[key]) matchesByRound[key] = [];
    matchesByRound[key].push(m);
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <Link to="/torneos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Torneos
        </Link>

        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{tournament.name}</h1>
          {tournament.description && <p className="text-sm text-muted-foreground mb-2">{tournament.description}</p>}
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {formatLabels[tournament.format] || tournament.format}
            </span>
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
              {tournament.type === "singles" ? "Individual" : "Dobles"}
            </span>
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
              {tournament.status === "registration" ? "Inscripción Abierta" : tournament.status === "in_progress" ? "En Curso" : "Finalizado"}
            </span>
          </div>
        </div>

        {/* Registered Players */}
        <div className="glass-card p-4 mb-4">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" /> Inscriptos ({registrations.length})
          </h2>
          {registrations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay jugadores inscriptos aún.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {registrations.map(r => (
                <div key={r.player_id} className="px-3 py-1.5 rounded bg-muted/50 text-xs">
                  <span className="font-medium text-foreground">{r.players?.full_name}</span>
                  <span className="text-muted-foreground ml-1">({r.players?.rating})</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Matches by round/group */}
        {Object.keys(matchesByRound).length > 0 && (
          <div className="space-y-3">
            {Object.entries(matchesByRound).map(([key, roundMatches]) => (
              <div key={key} className="glass-card p-4">
                <h3 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">{key}</h3>
                <div className="space-y-1">
                  {roundMatches.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded bg-muted/30 text-sm">
                      <div className="flex items-center gap-3 flex-1">
                        <span className={`${m.winner_id === m.player1_id ? "font-semibold" : "text-muted-foreground"}`}>
                          {playersMap[m.player1_id || ""] || "TBD"}
                        </span>
                      </div>
                      <span className="font-heading font-bold text-foreground px-3">
                        {m.player1_score ?? "-"} : {m.player2_score ?? "-"}
                      </span>
                      <div className="flex items-center gap-3 flex-1 justify-end">
                        <span className={`${m.winner_id === m.player2_id ? "font-semibold" : "text-muted-foreground"}`}>
                          {playersMap[m.player2_id || ""] || "TBD"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
