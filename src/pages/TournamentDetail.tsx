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
  set_scores: any;
}

interface GroupStanding {
  playerId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  points: number;
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

  // Separate group matches from elimination matches
  const groupMatches = matches.filter(m => m.group_name);
  const eliminationMatches = matches.filter(m => !m.group_name);

  // Build group standings
  const groupNames = [...new Set(groupMatches.map(m => m.group_name!))].sort();
  const groupStandings: Record<string, GroupStanding[]> = {};

  groupNames.forEach(gName => {
    const gMatches = groupMatches.filter(m => m.group_name === gName);
    const standingsMap: Record<string, GroupStanding> = {};

    gMatches.forEach(m => {
      const p1 = m.player1_id;
      const p2 = m.player2_id;
      if (!p1 || !p2) return;

      if (!standingsMap[p1]) standingsMap[p1] = { playerId: p1, name: playersMap[p1] || "TBD", played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, points: 0 };
      if (!standingsMap[p2]) standingsMap[p2] = { playerId: p2, name: playersMap[p2] || "TBD", played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, points: 0 };

      if (m.player1_score != null && m.player2_score != null) {
        standingsMap[p1].played++;
        standingsMap[p2].played++;
        standingsMap[p1].setsFor += m.player1_score;
        standingsMap[p1].setsAgainst += m.player2_score;
        standingsMap[p2].setsFor += m.player2_score;
        standingsMap[p2].setsAgainst += m.player1_score;

        if (m.winner_id === p1) {
          standingsMap[p1].won++;
          standingsMap[p1].points += 2;
          standingsMap[p2].lost++;
          standingsMap[p2].points += 1;
        } else if (m.winner_id === p2) {
          standingsMap[p2].won++;
          standingsMap[p2].points += 2;
          standingsMap[p1].lost++;
          standingsMap[p1].points += 1;
        }
      }
    });

    groupStandings[gName] = Object.values(standingsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst);
    });
  });

  // Group elimination matches by round
  const matchesByRound: Record<string, Match[]> = {};
  eliminationMatches.forEach(m => {
    const key = m.round || "Sin ronda";
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
                <Link key={r.player_id} to={`/jugador/${r.player_id}`} className="px-3 py-1.5 rounded bg-muted/50 text-xs hover:bg-muted transition-colors">
                  <span className="font-medium text-foreground">{r.players?.full_name}</span>
                  <span className="text-muted-foreground ml-1">({r.players?.rating})</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Group Standings */}
        {groupNames.length > 0 && (
          <div className="space-y-3 mb-4">
            <h2 className="font-heading font-semibold text-sm text-foreground">Tabla de Posiciones</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {groupNames.map(gName => (
                <div key={gName} className="glass-card overflow-hidden">
                  <div className="px-4 py-2 bg-muted/50">
                    <h3 className="font-heading font-semibold text-xs uppercase tracking-wide text-muted-foreground">{gName}</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left px-3 py-1.5 font-semibold">Jugador</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">PJ</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">PG</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">PP</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">SF</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">SC</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStandings[gName].map((s, i) => (
                        <tr key={s.playerId} className={`border-t border-border/30 text-xs ${i < 2 ? "bg-muted/20" : ""}`}>
                          <td className="px-3 py-1.5">
                            <Link to={`/jugador/${s.playerId}`} className="font-medium text-foreground hover:underline">
                              {s.name}
                            </Link>
                          </td>
                          <td className="text-center px-1.5 py-1.5 text-muted-foreground">{s.played}</td>
                          <td className="text-center px-1.5 py-1.5 font-medium">{s.won}</td>
                          <td className="text-center px-1.5 py-1.5 text-muted-foreground">{s.lost}</td>
                          <td className="text-center px-1.5 py-1.5 text-muted-foreground">{s.setsFor}</td>
                          <td className="text-center px-1.5 py-1.5 text-muted-foreground">{s.setsAgainst}</td>
                          <td className="text-center px-1.5 py-1.5 font-semibold">{s.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group Matches */}
        {groupNames.length > 0 && (
          <div className="space-y-3 mb-4">
            <h2 className="font-heading font-semibold text-sm text-foreground">Partidos de Grupo</h2>
            {groupNames.map(gName => {
              const gMatches = groupMatches.filter(m => m.group_name === gName);
              return (
                <div key={gName} className="glass-card p-4">
                  <h3 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">{gName}</h3>
                  <div className="space-y-1">
                    {gMatches.map(m => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded bg-muted/30 text-sm">
                        <span className={`flex-1 ${m.winner_id === m.player1_id ? "font-semibold" : "text-muted-foreground"}`}>
                          {playersMap[m.player1_id || ""] || "TBD"}
                        </span>
                        <span className="font-heading font-bold text-foreground px-3">
                          {m.player1_score ?? "-"} : {m.player2_score ?? "-"}
                        </span>
                        <span className={`flex-1 text-right ${m.winner_id === m.player2_id ? "font-semibold" : "text-muted-foreground"}`}>
                          {playersMap[m.player2_id || ""] || "TBD"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Elimination Matches */}
        {Object.keys(matchesByRound).length > 0 && (
          <div className="space-y-3">
            <h2 className="font-heading font-semibold text-sm text-foreground">
              {groupNames.length > 0 ? "Fase Eliminatoria" : "Partidos"}
            </h2>
            {Object.entries(matchesByRound).map(([key, roundMatches]) => (
              <div key={key} className="glass-card p-4">
                <h3 className="font-heading font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">{key}</h3>
                <div className="space-y-1">
                  {roundMatches.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded bg-muted/30 text-sm">
                      <span className={`flex-1 ${m.winner_id === m.player1_id ? "font-semibold" : "text-muted-foreground"}`}>
                        {playersMap[m.player1_id || ""] || "TBD"}
                      </span>
                      <span className="font-heading font-bold text-foreground px-3">
                        {m.player1_score ?? "-"} : {m.player2_score ?? "-"}
                      </span>
                      <span className={`flex-1 text-right ${m.winner_id === m.player2_id ? "font-semibold" : "text-muted-foreground"}`}>
                        {playersMap[m.player2_id || ""] || "TBD"}
                      </span>
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
