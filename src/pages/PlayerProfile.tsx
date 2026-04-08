import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";

interface Player {
  id: string;
  full_name: string;
  dni: string;
  rating: number;
  created_at: string;
}

interface Match {
  id: string;
  tournament_id: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  round: string | null;
  group_name: string | null;
  rating_change_p1: number | null;
  rating_change_p2: number | null;
  created_at: string;
}

interface TournamentMap {
  [id: string]: string;
}

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, string>>({});
  const [tournamentsMap, setTournamentsMap] = useState<TournamentMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const [pRes, m1Res, m2Res] = await Promise.all([
        supabase.from("players").select("*").eq("id", id).single(),
        supabase.from("matches").select("*").eq("player1_id", id).order("created_at", { ascending: false }),
        supabase.from("matches").select("*").eq("player2_id", id).order("created_at", { ascending: false }),
      ]);

      setPlayer(pRes.data as Player | null);

      const allMatches = [...(m1Res.data || []), ...(m2Res.data || [])];
      allMatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMatches(allMatches);

      // Get all player and tournament names
      const playerIds = new Set<string>();
      const tournamentIds = new Set<string>();
      allMatches.forEach(m => {
        if (m.player1_id) playerIds.add(m.player1_id);
        if (m.player2_id) playerIds.add(m.player2_id);
        tournamentIds.add(m.tournament_id);
      });

      if (playerIds.size > 0) {
        const { data: players } = await supabase.from("players").select("id, full_name").in("id", Array.from(playerIds));
        const pMap: Record<string, string> = {};
        (players || []).forEach(p => { pMap[p.id] = p.full_name; });
        setPlayersMap(pMap);
      }

      if (tournamentIds.size > 0) {
        const { data: tournaments } = await supabase.from("tournaments").select("id, name").in("id", Array.from(tournamentIds));
        const tMap: TournamentMap = {};
        (tournaments || []).forEach(t => { tMap[t.id] = t.name; });
        setTournamentsMap(tMap);
      }

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

  if (!player) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Jugador no encontrado.</div>
      </div>
    );
  }

  const wins = matches.filter(m => m.winner_id === id).length;
  const losses = matches.length - wins;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  // Win streak
  let currentStreak = 0;
  for (const m of matches) {
    if (m.winner_id === id) currentStreak++;
    else break;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Link to="/rankings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Rankings
        </Link>

        {/* Player Header */}
        <div className="glass-card p-6 mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{player.full_name}</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Miembro desde {new Date(player.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Rating", value: player.rating },
              { label: "Victorias", value: wins },
              { label: "Derrotas", value: losses },
              { label: "% Victorias", value: `${winRate}%` },
            ].map(stat => (
              <div key={stat.label} className="bg-muted/50 rounded-md px-3 py-2.5 text-center">
                <div className="text-xs text-muted-foreground mb-0.5">{stat.label}</div>
                <div className="font-heading font-bold text-lg text-foreground">{stat.value}</div>
              </div>
            ))}
          </div>
          {currentStreak > 1 && (
            <p className="text-sm text-muted-foreground mt-3">🔥 Racha actual: {currentStreak} victorias</p>
          )}
        </div>

        {/* Match History */}
        <h2 className="font-heading font-semibold text-foreground mb-3">Historial de Partidos</h2>
        {matches.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">Sin partidos registrados.</div>
        ) : (
          <div className="space-y-1.5">
            {matches.map(m => {
              const isP1 = m.player1_id === id;
              const won = m.winner_id === id;
              const opponent = isP1 ? playersMap[m.player2_id || ""] : playersMap[m.player1_id || ""];
              const ratingChange = isP1 ? m.rating_change_p1 : m.rating_change_p2;
              const myScore = isP1 ? m.player1_score : m.player2_score;
              const oppScore = isP1 ? m.player2_score : m.player1_score;

              return (
                <div key={m.id} className="glass-card px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${won ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}>
                      {won ? "V" : "D"}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-foreground">vs {opponent || "TBD"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{myScore} - {oppScore}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ratingChange != null && ratingChange !== 0 && (
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${ratingChange > 0 ? "text-success" : "text-destructive"}`}>
                        {ratingChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {ratingChange > 0 ? "+" : ""}{ratingChange}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{tournamentsMap[m.tournament_id] || ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
