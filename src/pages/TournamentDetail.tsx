import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Users, ArrowLeft, Zap, XCircle, SkipForward, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

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
  match_order: number | null;
  rating_change_p1: number | null;
  rating_change_p2: number | null;
  set_scores: any;
}

interface SetScore { p1: string; p2: string }

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
  const { isAdmin, adminToken } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Admin: record match inline
  const [recordingMatchId, setRecordingMatchId] = useState<string | null>(null);
  const [matchSets, setMatchSets] = useState<SetScore[]>([{ p1: "", p2: "" }, { p1: "", p2: "" }, { p1: "", p2: "" }]);

  const fetchAll = async () => {
    if (!id) return;
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

  useEffect(() => { fetchAll(); }, [id]);

  const handleStartTournament = async () => {
    if (!adminToken || !id) return;
    const data = await adminAction("generate_bracket", { tournament_id: id }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success(`Torneo iniciado: ${data.matches_created} partidos generados`);
    fetchAll();
  };

  const handleCancelTournament = async () => {
    if (!adminToken || !id || !confirm("¿Cancelar este torneo?")) return;
    await adminAction("update_tournament_status", { tournament_id: id, status: "finished" }, adminToken);
    toast.success("Torneo cancelado");
    fetchAll();
  };

  const handleRecordResult = async (match: Match) => {
    if (!adminToken || !id) return;
    const validSets = matchSets.filter(s => s.p1 !== "" && s.p2 !== "");
    if (validSets.length < 2) { toast.error("Mínimo 2 sets"); return; }
    const set_scores = validSets.map(s => ({ p1: parseInt(s.p1), p2: parseInt(s.p2) }));

    const isFinal = match.round?.toLowerCase() === "final";
    const neededWins = isFinal ? 3 : 2;
    let p1W = 0, p2W = 0;
    set_scores.forEach(s => { if (s.p1 > s.p2) p1W++; else p2W++; });
    if (p1W < neededWins && p2W < neededWins) {
      toast.error(`Alguien debe ganar ${neededWins} sets (mejor de ${isFinal ? 5 : 3})`);
      return;
    }

    const data = await adminAction("record_match", {
      tournament_id: id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      set_scores,
      round: match.round,
      group_name: match.group_name,
      match_order: match.match_order,
      existing_match_id: match.id,
    }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Resultado registrado");
    setRecordingMatchId(null);
    setMatchSets([{ p1: "", p2: "" }, { p1: "", p2: "" }, { p1: "", p2: "" }]);
    fetchAll();
  };

  const handleAdvancePhase = async () => {
    if (!adminToken || !id) return;
    const data = await adminAction("advance_phase", { tournament_id: id }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success(data.message || "Fase avanzada");
    fetchAll();
  };

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

  const groupMatches = matches.filter(m => m.group_name);
  const eliminationMatches = matches.filter(m => !m.group_name);

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
        standingsMap[p1].played++; standingsMap[p2].played++;
        standingsMap[p1].setsFor += m.player1_score; standingsMap[p1].setsAgainst += m.player2_score;
        standingsMap[p2].setsFor += m.player2_score; standingsMap[p2].setsAgainst += m.player1_score;
        if (m.winner_id === p1) { standingsMap[p1].won++; standingsMap[p1].points += 2; standingsMap[p2].lost++; standingsMap[p2].points += 1; }
        else if (m.winner_id === p2) { standingsMap[p2].won++; standingsMap[p2].points += 2; standingsMap[p1].lost++; standingsMap[p1].points += 1; }
      }
    });
    groupStandings[gName] = Object.values(standingsMap).sort((a, b) => b.points !== a.points ? b.points - a.points : (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst));
  });

  const matchesByRound: Record<string, Match[]> = {};
  eliminationMatches.forEach(m => {
    const key = m.round || "Sin ronda";
    if (!matchesByRound[key]) matchesByRound[key] = [];
    matchesByRound[key].push(m);
  });

  // Check if all matches in current round are complete
  const allCurrentRoundComplete = eliminationMatches.length > 0 && eliminationMatches.filter(m => !m.winner_id).length === 0;

  const renderMatchCard = (m: Match) => {
    const setDetail = m.set_scores ? (m.set_scores as Array<{p1:number;p2:number}>).map((s: any) => `${s.p1}-${s.p2}`).join(", ") : "";
    const isRecording = recordingMatchId === m.id;
    const canRecord = isAdmin && !m.winner_id && m.player1_id && m.player2_id;
    const isFinal = m.round?.toLowerCase() === "final";
    const maxSets = isFinal ? 5 : 3;

    return (
      <div key={m.id} className="px-4 py-3 rounded-lg bg-muted/30 text-sm">
        <div className="flex items-center justify-between">
          <span className={`flex-1 ${m.winner_id === m.player1_id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {playersMap[m.player1_id || ""] || "TBD"}
          </span>
          <span className="font-heading font-bold text-foreground px-3">
            {m.winner_id ? `${m.player1_score ?? "-"} : ${m.player2_score ?? "-"}` : "vs"}
          </span>
          <span className={`flex-1 text-right ${m.winner_id === m.player2_id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {playersMap[m.player2_id || ""] || "TBD"}
          </span>
        </div>
        {setDetail && <p className="text-xs text-muted-foreground mt-1 text-center">{setDetail}</p>}

        {canRecord && !isRecording && (
          <Button
            size="sm" variant="outline" className="w-full mt-2 text-xs"
            onClick={() => {
              setRecordingMatchId(m.id);
              setMatchSets(Array.from({ length: Math.min(maxSets, 3) }, () => ({ p1: "", p2: "" })));
            }}
          >
            Registrar resultado
          </Button>
        )}

        {isRecording && (
          <div className="mt-3 p-3 rounded-lg bg-card border border-border space-y-2">
            <p className="text-xs text-muted-foreground">Mejor de {maxSets === 5 ? "5 (final)" : "3"}</p>
            {matchSets.map((set, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">S{i + 1}</span>
                <Input type="number" placeholder="J1" value={set.p1} min="0"
                  onChange={e => { const n = [...matchSets]; n[i] = { ...n[i], p1: e.target.value }; setMatchSets(n); }}
                  className="w-20 h-8 text-sm" />
                <span className="text-muted-foreground">-</span>
                <Input type="number" placeholder="J2" value={set.p2} min="0"
                  onChange={e => { const n = [...matchSets]; n[i] = { ...n[i], p2: e.target.value }; setMatchSets(n); }}
                  className="w-20 h-8 text-sm" />
                {matchSets.length > 2 && (
                  <button type="button" onClick={() => setMatchSets(matchSets.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                )}
              </div>
            ))}
            {matchSets.length < maxSets && (
              <button type="button" onClick={() => setMatchSets([...matchSets, { p1: "", p2: "" }])} className="text-xs text-primary hover:underline">
                + Agregar set
              </button>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => handleRecordResult(m)}>Confirmar</Button>
              <Button size="sm" variant="ghost" onClick={() => setRecordingMatchId(null)}>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <Link to="/torneos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Torneos
        </Link>

        <div className="mb-6 animate-slide-up">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{tournament.name}</h1>
              {tournament.description && <p className="text-sm text-muted-foreground mb-2">{tournament.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
                  {formatLabels[tournament.format] || tournament.format}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
                  {tournament.type === "singles" ? "Individual" : "Dobles"}
                </span>
                <span className={`px-2 py-0.5 rounded-md font-medium ${tournament.status === "in_progress" ? "bg-accent/20 text-accent-foreground" : tournament.status === "finished" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                  {tournament.status === "registration" ? "Inscripción Abierta" : tournament.status === "in_progress" ? "🔴 En Curso" : "Finalizado"}
                </span>
              </div>
            </div>

            {/* Admin controls */}
            {isAdmin && tournament.status !== "finished" && (
              <div className="flex gap-2">
                {tournament.status === "registration" && registrations.length >= 2 && (
                  <Button size="sm" onClick={handleStartTournament} className="gap-1">
                    <Zap className="w-4 h-4" /> Iniciar
                  </Button>
                )}
                {tournament.status === "in_progress" && allCurrentRoundComplete && (
                  <Button size="sm" variant="outline" onClick={handleAdvancePhase} className="gap-1">
                    <SkipForward className="w-4 h-4" /> Siguiente fase
                  </Button>
                )}
                <Button size="sm" variant="destructive" onClick={handleCancelTournament} className="gap-1">
                  <XCircle className="w-4 h-4" /> Cancelar
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Registered Players */}
        <div className="glass-card p-4 mb-4 animate-slide-up stagger-1">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Inscriptos ({registrations.length})
          </h2>
          {registrations.length === 0 ? (
            <p className="text-muted-foreground text-sm">No hay jugadores inscriptos aún.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {registrations.map(r => (
                <Link key={r.player_id} to={`/jugador/${r.player_id}`} className="px-3 py-1.5 rounded-lg bg-muted/50 text-xs hover:bg-muted transition-colors">
                  <span className="font-medium text-foreground">{r.players?.full_name}</span>
                  <span className="text-muted-foreground ml-1">({r.players?.rating})</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Group Standings */}
        {groupNames.length > 0 && (
          <div className="space-y-3 mb-4 animate-slide-up stagger-2">
            <h2 className="font-heading font-semibold text-sm text-foreground">Tabla de Posiciones</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {groupNames.map(gName => (
                <div key={gName} className="glass-card overflow-hidden">
                  <div className="px-4 py-2 bg-primary/5">
                    <h3 className="font-heading font-semibold text-xs uppercase tracking-wide text-primary">{gName}</h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-muted-foreground">
                        <th className="text-left px-3 py-1.5 font-semibold">Jugador</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">PJ</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">PG</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">PP</th>
                        <th className="text-center px-1.5 py-1.5 font-semibold">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupStandings[gName].map((s, i) => (
                        <tr key={s.playerId} className={`border-t border-border/30 text-xs ${i < 2 ? "bg-primary/5" : ""}`}>
                          <td className="px-3 py-1.5">
                            <Link to={`/jugador/${s.playerId}`} className="font-medium text-foreground hover:underline">{s.name}</Link>
                          </td>
                          <td className="text-center px-1.5 py-1.5 text-muted-foreground">{s.played}</td>
                          <td className="text-center px-1.5 py-1.5 font-medium">{s.won}</td>
                          <td className="text-center px-1.5 py-1.5 text-muted-foreground">{s.lost}</td>
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
                  <h3 className="font-heading font-semibold text-xs text-primary uppercase tracking-wide mb-2">{gName}</h3>
                  <div className="space-y-1.5">{gMatches.map(renderMatchCard)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Elimination Matches */}
        {Object.keys(matchesByRound).length > 0 && (
          <div className="space-y-3 animate-slide-up stagger-3">
            <h2 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              {groupNames.length > 0 ? "Fase Eliminatoria" : "Partidos"}
            </h2>
            {Object.entries(matchesByRound).map(([key, roundMatches]) => (
              <div key={key} className="glass-card p-4">
                <h3 className="font-heading font-semibold text-xs text-primary uppercase tracking-wide mb-2">{key}</h3>
                <div className="space-y-1.5">{roundMatches.map(renderMatchCard)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
