import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Users, ArrowLeft, Zap, XCircle, SkipForward, Trophy, ZoomIn, ZoomOut, Maximize, CircleDot } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DigitalScoresheet } from "@/components/DigitalScoresheet";
import { LiveUmpire } from "@/components/LiveUmpire";
import { MatchChronicle } from "@/components/MatchChronicle";
import { authAction } from "@/lib/api";

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
  set_scores: Array<{p1: number, p2: number}> | null;
  ai_chronicle: string | null;
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
  const { player, playerToken, isAdmin, adminToken } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Admin: record match inline
  const [recordingMatchId, setRecordingMatchId] = useState<string | null>(null);
  const [matchSets, setMatchSets] = useState<SetScore[]>([{ p1: "", p2: "" }, { p1: "", p2: "" }, { p1: "", p2: "" }]);
  
  // Live Umpiring
  const [liveUmpireMatch, setLiveUmpireMatch] = useState<Match | null>(null);

  // Scoresheet Modal
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // Zoom / Pan
  const [zoom, setZoom] = useState(1);
  const bracketRef = useRef<HTMLDivElement>(null);

  const fetchAll = async () => {
    if (!id) return;
    const [tRes, rRes, mRes] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", id).single(),
      supabase.from("tournament_registrations").select("player_id, players(full_name, rating)").eq("tournament_id", id),
      supabase.from("matches").select("*").eq("tournament_id", id).order("match_order"),
    ]);
    setTournament(tRes.data as Tournament | null);
    setRegistrations((rRes.data || []) as unknown as Registration[]);
    setMatches((mRes.data || []) as unknown as Match[]);
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
    if (!id || (!adminToken && !playerToken)) return;
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

    let data;
    if (isAdmin && adminToken) {
      data = await adminAction("record_match", {
        tournament_id: id,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        set_scores,
        round: match.round,
        group_name: match.group_name,
        match_order: match.match_order,
        existing_match_id: match.id,
      }, adminToken);
    } else {
      // Allow players to record match
      data = await authAction("record_match", {
        tournament_id: id,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        set_scores,
        round: match.round,
        group_name: match.group_name,
        match_order: match.match_order,
        existing_match_id: match.id,
        player_id: player?.id,
        player_token: playerToken,
      });
    }

    if (data?.error) { toast.error(data.error); return; }
    toast.success("Resultado registrado");
    setRecordingMatchId(null);
    setMatchSets([{ p1: "", p2: "" }, { p1: "", p2: "" }, { p1: "", p2: "" }]);
    fetchAll();
  };

  const handleLiveMatchFinish = async (sets: {p1: number, p2: number}[], durationSeconds: number) => {
    if (!id || !liveUmpireMatch || (!adminToken && !playerToken)) return;
    
    const isFinal = liveUmpireMatch.round?.toLowerCase() === "final";
    const neededWins = isFinal ? 3 : 2;
    let p1W = 0, p2W = 0;
    sets.forEach(s => { if (s.p1 > s.p2) p1W++; else p2W++; });
    
    if (p1W < neededWins && p2W < neededWins) {
      toast.error(`El partido finalizó sin un ganador claro. Alguien debe ganar ${neededWins} sets.`);
      return;
    }

    toast.info("Guardando resultado...");
    
    let data;
    if (isAdmin && adminToken) {
      data = await adminAction("record_match", {
        tournament_id: id,
        player1_id: liveUmpireMatch.player1_id,
        player2_id: liveUmpireMatch.player2_id,
        set_scores: sets,
        round: liveUmpireMatch.round,
        group_name: liveUmpireMatch.group_name,
        match_order: liveUmpireMatch.match_order,
        existing_match_id: liveUmpireMatch.id,
      }, adminToken);
    } else {
      data = await authAction("record_match", {
        tournament_id: id,
        player1_id: liveUmpireMatch.player1_id,
        player2_id: liveUmpireMatch.player2_id,
        set_scores: sets,
        round: liveUmpireMatch.round,
        group_name: liveUmpireMatch.group_name,
        match_order: liveUmpireMatch.match_order,
        existing_match_id: liveUmpireMatch.id,
        player_id: player?.id,
        player_token: playerToken,
      });
    }
    
    if (data?.error) { 
      toast.error(data.error); 
      return; 
    }
    
    toast.success(`¡Partido registrado! Duración: ${Math.floor(durationSeconds/60)}m ${durationSeconds%60}s`);
    setLiveUmpireMatch(null);
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

  // Check if all matches in current round or group stage are complete
  const allGroupMatchesComplete = groupMatches.length > 0 && groupMatches.every(m => m.winner_id);
  const allEliminationMatchesComplete = eliminationMatches.length > 0 && eliminationMatches.every(m => m.winner_id);
  const allCurrentRoundComplete = (groupMatches.length > 0 && eliminationMatches.length === 0) 
    ? allGroupMatchesComplete 
    : (eliminationMatches.length > 0 ? allEliminationMatchesComplete : false);

  const renderMatchCard = (m: Match) => {
    const setDetail = m.set_scores ? m.set_scores.map((s) => `${s.p1}-${s.p2}`).join(", ") : "";
    const isRecording = recordingMatchId === m.id;
    const canRecord = !!player && !m.winner_id && m.player1_id && m.player2_id;
    const isFinal = m.round?.toLowerCase() === "final";
    const maxSets = isFinal ? 5 : 3;
    const isLive = isRecording || liveUmpireMatch?.id === m.id;

    return (
      <div key={m.id} className={`group relative overflow-hidden p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${isFinal ? "bg-gradient-to-br from-primary/20 via-background to-accent/10 border-primary/40" : "bg-card/80 backdrop-blur-md border-border/50 hover:border-primary/30"} ${isLive ? 'ring-2 ring-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : ''}`}>
        {isLive && (
          <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg flex items-center gap-1 z-20 animate-pulse">
            <CircleDot className="w-2 h-2" /> LIVE
          </div>
        )}
        {/* Decorative elements */}
        <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none transform -rotate-12 group-hover:scale-110 transition-transform">
          <Trophy className="w-20 h-20" />
        </div>

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex-1 flex flex-col items-start min-w-0">
            <span className={`text-sm truncate w-full ${m.winner_id === m.player1_id ? "font-bold text-primary" : "text-muted-foreground"}`}>
              {playersMap[m.player1_id || ""] || "TBD"}
            </span>
            {m.rating_change_p1 !== null && m.rating_change_p1 !== 0 && (
              <span className={`text-[10px] ${m.rating_change_p1 > 0 ? "text-green-500" : "text-red-500"}`}>
                {m.rating_change_p1 > 0 ? "+" : ""}{m.rating_change_p1}
              </span>
            )}
          </div>

          <div className="flex flex-col items-center px-4">
            <div className="bg-muted/50 px-3 py-1 rounded-full border border-border/20 shadow-inner">
              <span className="font-heading font-black text-lg tracking-tighter text-foreground">
                {m.winner_id ? `${m.player1_score ?? 0} - ${m.player2_score ?? 0}` : "VS"}
              </span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-end min-w-0">
            <span className={`text-sm truncate w-full text-right ${m.winner_id === m.player2_id ? "font-bold text-primary" : "text-muted-foreground"}`}>
              {playersMap[m.player2_id || ""] || "TBD"}
            </span>
            {m.rating_change_p2 !== null && m.rating_change_p2 !== 0 && (
              <span className={`text-[10px] ${m.rating_change_p2 > 0 ? "text-green-500" : "text-red-500"}`}>
                {m.rating_change_p2 > 0 ? "+" : ""}{m.rating_change_p2}
              </span>
            )}
          </div>
        </div>

        {setDetail && (
          <div className="flex justify-center gap-1.5 mt-2 relative z-10">
            {m.set_scores?.map((s, i) => (
              <span key={i} className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded border border-border/10 text-muted-foreground">
                {s.p1}-{s.p2}
              </span>
            ))}
          </div>
        )}

        {m.winner_id && !isRecording && (
          <div className="absolute inset-0 bg-transparent cursor-pointer z-0" onClick={() => setSelectedMatch(m)} />
        )}

        {/* AI Chronicle */}
        {m.winner_id && !isRecording && (
          <div className="relative z-10">
            <MatchChronicle
              chronicle={m.ai_chronicle}
              matchId={m.id}
              type="match"
              isAdmin={isAdmin}
              adminToken={adminToken}
              onRegenerated={fetchAll}
              compact
            />
          </div>
        )}

        {canRecord && !isRecording && (
          <div className="mt-2 flex gap-2 relative z-10">
            <Button
              size="sm" variant="default" className="flex-1 text-xs font-bold"
              onClick={() => setLiveUmpireMatch(m)}
            >
              Arbitrar en Vivo
            </Button>
            <Button
              size="sm" variant="outline" className="flex-1 text-xs"
              onClick={() => {
                setRecordingMatchId(m.id);
                setMatchSets(Array.from({ length: Math.min(maxSets, 3) }, () => ({ p1: "", p2: "" })));
              }}
            >
              Subir Manual
            </Button>
          </div>
        )}

        {isRecording && (
          <div className="mt-3 space-y-3">
            <div className="space-y-3 p-3 rounded-xl bg-black/20 border border-white/5">
              <p className="text-xs text-muted-foreground">Mejor de {maxSets === 5 ? "5 (final)" : "3"}</p>
              {matchSets.map((set, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-primary/80 w-6">S{i + 1}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <Input type="number" placeholder="0" value={set.p1} min="0"
                      onChange={e => { const n = [...matchSets]; n[i] = { ...n[i], p1: e.target.value }; setMatchSets(n); }}
                      className="w-full h-9 text-center font-heading font-bold bg-background/50 border-primary/20 focus-visible:ring-primary shadow-inner" />
                    <span className="text-muted-foreground/30">:</span>
                    <Input type="number" placeholder="0" value={set.p2} min="0"
                      onChange={e => { const n = [...matchSets]; n[i] = { ...n[i], p2: e.target.value }; setMatchSets(n); }}
                      className="w-full h-9 text-center font-heading font-bold bg-background/50 border-primary/20 focus-visible:ring-primary shadow-inner" />
                  </div>
                  {matchSets.length > 2 && (
                    <button type="button" onClick={() => setMatchSets(matchSets.filter((_, j) => j !== i))} className="p-1.5 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors">✕</button>
                  )}
                </div>
              ))}
            </div>
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
                  <div className="space-y-3">{gMatches.map(renderMatchCard)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Elimination Matches (Bracket View) */}
        {Object.keys(matchesByRound).length > 0 && (() => {
          const ROUND_WEIGHTS: Record<string, number> = { "final": 100, "semifinal": 90, "cuartos": 80, "octavos": 70, "16vos": 60, "32vos": 50, "64vos": 40 };
          const getRoundWeight = (r: string) => {
            const low = r.toLowerCase();
            if (ROUND_WEIGHTS[low]) return ROUND_WEIGHTS[low];
            const m = low.match(/ronda de (\d+)/);
            if (m) return 100 - parseInt(m[1]);
            return 0;
          };
          const orderedRounds = Object.keys(matchesByRound).sort((a, b) => getRoundWeight(a) - getRoundWeight(b));

          return (
            <div className="space-y-3 animate-slide-up stagger-3">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  {groupNames.length > 0 ? "Fase Eliminatoria" : "Brackets del Torneo"}
                </h2>
                <div className="flex gap-1.5 bg-card/80 p-1 rounded-lg border border-border/50 backdrop-blur-md z-10">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setZoom(1)}>
                    <Maximize className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setZoom(z => Math.min(z + 0.2, 2))}>
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="glass-card p-6 overflow-x-auto hide-scrollbar relative bg-black/20" ref={bracketRef}>
                <div 
                  className="flex gap-12 min-w-max pb-4 items-stretch origin-top-left transition-transform duration-300"
                  style={{ transform: `scale(${zoom})` }}
                >
                    {orderedRounds.map((roundName, roundIdx) => (
                      <div key={roundName} className="flex flex-col min-w-[280px]">
                        <h3 className="font-heading font-semibold text-xs text-primary uppercase tracking-wide mb-8 text-center bg-primary/10 py-2 rounded-md border border-primary/20 shadow-sm">{roundName}</h3>
                        <div className="flex flex-col justify-around flex-1 gap-8 relative">
                          {matchesByRound[roundName].sort((a, b) => (a.match_order || 0) - (b.match_order || 0)).map((match, mIdx) => {
                            const isFinished = !!match.winner_id;
                            
                            return (
                              <div key={match.id} className="relative group pointer-events-auto">
                                {/* Connector Right (Outgoing to next round) */}
                                {roundIdx < orderedRounds.length - 1 && (
                                  <div className={`absolute top-1/2 -right-8 w-8 border-t-2 z-0 ${mIdx % 2 === 0 ? "rounded-tr-lg" : "rounded-br-lg"} transition-all duration-700 ease-in-out ${isFinished ? 'border-primary shadow-[0_0_15px_hsl(var(--primary)/0.4)]' : 'border-primary/20'}`} style={{ height: 'calc(50% + 1rem)', borderLeft: `2px solid ${isFinished ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.2)'}`, borderRight: '0' }}>
                                    {mIdx % 2 === 0 ? (
                                      <div className={`absolute top-0 right-0 w-2 h-2 rounded-full -translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${isFinished ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse' : 'bg-primary/20'}`} />
                                    ) : (
                                      <div className={`absolute bottom-0 right-0 w-2 h-2 rounded-full translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${isFinished ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary))] animate-pulse' : 'bg-primary/20'}`} />
                                    )}
                                  </div>
                                )}
                                {/* Connector Left (Incoming from previous round) */}
                                {roundIdx > 0 && (() => {
                                  const hasPlayers = !!(match.player1_id && match.player2_id);
                                  return (
                                    <div className={`absolute top-1/2 -left-8 w-8 h-[2px] z-0 transition-colors duration-700 ${hasPlayers ? 'bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]' : 'bg-primary/20'}`}>
                                      <div className={`absolute left-0 top-0 w-2 h-2 rounded-full -translate-y-1/2 -translate-x-1/2 transition-colors duration-500 ${hasPlayers ? 'bg-primary' : 'bg-primary/20'}`} />
                                    </div>
                                  );
                                })()}
                                
                                {renderMatchCard(match)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Digital Scoresheet Modal */}
        {selectedMatch && (
          <Dialog open={!!selectedMatch} onOpenChange={(open) => !open && setSelectedMatch(null)}>
            <DialogContent className="sm:max-w-xl bg-transparent border-none shadow-none p-0">
              <DialogTitle className="sr-only">Acta de Partido</DialogTitle>
              <DialogDescription className="sr-only">Detalles del resultado del partido</DialogDescription>
              <DigitalScoresheet
                player1Name={playersMap[selectedMatch.player1_id || ""] || "TBD"}
                player2Name={playersMap[selectedMatch.player2_id || ""] || "TBD"}
                player1Score={selectedMatch.player1_score || 0}
                player2Score={selectedMatch.player2_score || 0}
                setScores={selectedMatch.set_scores || []}
                winnerId={selectedMatch.winner_id}
                p1Id={selectedMatch.player1_id || ""}
                p2Id={selectedMatch.player2_id || ""}
                matchDate={new Date().toISOString()} // A real implementation might use match.created_at if available
              />
            </DialogContent>
          </Dialog>
        )}

        {/* Live Umpire Modal */}
        {liveUmpireMatch && (
          <LiveUmpire
            player1Name={playersMap[liveUmpireMatch.player1_id || ""] || "Jugador 1"}
            player2Name={playersMap[liveUmpireMatch.player2_id || ""] || "Jugador 2"}
            maxSets={liveUmpireMatch.round?.toLowerCase() === "final" ? 5 : 3}
            onFinishMatch={handleLiveMatchFinish}
            onCancel={() => setLiveUmpireMatch(null)}
          />
        )}
      </div>
    </div>
  );
}
