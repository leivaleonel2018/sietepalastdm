import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { authAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Lock, Swords } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

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
  set_scores: any;
  created_at: string;
}

interface TournamentInfo {
  id: string;
  name: string;
  status: string;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  set_scores: any;
  challenger_sets_won: number | null;
  challenged_sets_won: number | null;
  winner_id: string | null;
  rating_change_challenger: number | null;
  rating_change_challenged: number | null;
  created_at: string;
}

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const { player: loggedPlayer, playerToken } = useAuth();
  const [player, setPlayer] = useState<Player | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, string>>({});
  const [tournamentsMap, setTournamentsMap] = useState<Record<string, TournamentInfo>>({});
  const [tournamentIds, setTournamentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);

  const isOwnProfile = loggedPlayer?.id === id;
  const canChallenge = loggedPlayer && !isOwnProfile;

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const [pRes, m1Res, m2Res, regsRes, cRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", id).single(),
        supabase.from("matches").select("*").eq("player1_id", id).order("created_at", { ascending: false }),
        supabase.from("matches").select("*").eq("player2_id", id).order("created_at", { ascending: false }),
        supabase.from("tournament_registrations").select("tournament_id").eq("player_id", id),
        supabase.from("challenges").select("*").or(`challenger_id.eq.${id},challenged_id.eq.${id}`).order("created_at", { ascending: false }),
      ]);

      setPlayer(pRes.data as Player | null);
      setChallenges((cRes.data || []) as Challenge[]);

      const allMatches = [...(m1Res.data || []), ...(m2Res.data || [])];
      allMatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setMatches(allMatches);

      const tIds = new Set<string>();
      allMatches.forEach(m => tIds.add(m.tournament_id));
      (regsRes.data || []).forEach(r => tIds.add(r.tournament_id));
      const tIdArr = Array.from(tIds);
      setTournamentIds(tIdArr);

      const playerIds = new Set<string>();
      allMatches.forEach(m => {
        if (m.player1_id) playerIds.add(m.player1_id);
        if (m.player2_id) playerIds.add(m.player2_id);
      });
      (cRes.data || []).forEach((c: any) => {
        playerIds.add(c.challenger_id);
        playerIds.add(c.challenged_id);
      });

      if (playerIds.size > 0) {
        const { data: players } = await supabase.from("players").select("id, full_name").in("id", Array.from(playerIds));
        const pMap: Record<string, string> = {};
        (players || []).forEach(p => { pMap[p.id] = p.full_name; });
        setPlayersMap(pMap);
      }

      if (tIdArr.length > 0) {
        const { data: tournaments } = await supabase.from("tournaments").select("id, name, status").in("id", tIdArr);
        const tMap: Record<string, TournamentInfo> = {};
        (tournaments || []).forEach(t => { tMap[t.id] = t; });
        setTournamentsMap(tMap);
      }

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const handleChallenge = async () => {
    if (!loggedPlayer || !id) return;
    setChallengeLoading(true);
    const result = await authAction("create_challenge", {
      challenger_id: loggedPlayer.id,
      challenged_id: id,
      player_token: playerToken,
    });
    setChallengeLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("¡Desafío enviado!");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (pwForm.newPw.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setPwLoading(true);
    const result = await authAction("change_password", {
      player_id: id,
      current_password: pwForm.current,
      new_password: pwForm.newPw,
    });
    setPwLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Contraseña actualizada");
      setPwForm({ current: "", newPw: "", confirm: "" });
      setShowPasswordForm(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Cargando...</div></div>;
  }
  if (!player) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Jugador no encontrado.</div></div>;
  }

  const wins = matches.filter(m => m.winner_id === id).length;
  const losses = matches.length - wins;
  const winRate = matches.length > 0 ? Math.round((wins / matches.length) * 100) : 0;

  let currentStreak = 0;
  for (const m of matches) {
    if (m.winner_id === id) currentStreak++;
    else break;
  }

  const matchesByTournament: Record<string, Match[]> = {};
  matches.forEach(m => {
    if (!matchesByTournament[m.tournament_id]) matchesByTournament[m.tournament_id] = [];
    matchesByTournament[m.tournament_id].push(m);
  });
  tournamentIds.forEach(tId => {
    if (!matchesByTournament[tId]) matchesByTournament[tId] = [];
  });

  const completedChallenges = challenges.filter(c => c.status === "completed");

  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Link to="/rankings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Rankings
        </Link>

        {/* Player Header */}
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{player.full_name}</h1>
              <p className="text-sm text-muted-foreground">
                Miembro desde {new Date(player.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="flex gap-2">
              {canChallenge && (
                <Button
                  onClick={handleChallenge}
                  disabled={challengeLoading}
                  size="sm"
                  className="gap-1.5 shadow-sm"
                >
                  <Swords className="w-4 h-4" />
                  {challengeLoading ? "Enviando..." : "Desafiar"}
                </Button>
              )}
              {isOwnProfile && (
                <button
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
                  className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Lock className="w-3 h-3" /> Cambiar clave
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Rating", value: player.rating },
              { label: "Victorias", value: wins },
              { label: "Derrotas", value: losses },
              { label: "% Victorias", value: `${winRate}%` },
            ].map((stat, i) => (
              <div key={stat.label} className="stat-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="text-xs text-muted-foreground mb-0.5">{stat.label}</div>
                <div className="font-heading font-bold text-xl text-foreground">{stat.value}</div>
              </div>
            ))}
          </div>
          {currentStreak > 1 && (
            <p className="text-sm text-muted-foreground mt-3">🔥 Racha actual: {currentStreak} victorias</p>
          )}

          {showPasswordForm && isOwnProfile && (
            <form onSubmit={handlePasswordChange} className="mt-4 p-4 rounded-lg bg-muted/30 space-y-2.5">
              <div>
                <Label className="text-xs">Contraseña actual</Label>
                <Input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required />
              </div>
              <div>
                <Label className="text-xs">Nueva contraseña</Label>
                <Input type="password" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} required minLength={6} />
              </div>
              <div>
                <Label className="text-xs">Confirmar nueva contraseña</Label>
                <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required />
              </div>
              <Button type="submit" size="sm" disabled={pwLoading}>
                {pwLoading ? "Guardando..." : "Guardar"}
              </Button>
            </form>
          )}
        </div>

        {/* Challenge History */}
        {completedChallenges.length > 0 && (
          <>
            <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2 animate-slide-up stagger-1">
              <Swords className="w-4 h-4 text-primary" /> Desafíos ({completedChallenges.length})
            </h2>
            <div className="space-y-1.5 mb-6">
              {completedChallenges.map(c => {
                const isChallenger = c.challenger_id === id;
                const won = c.winner_id === id;
                const opponent = isChallenger ? playersMap[c.challenged_id] : playersMap[c.challenger_id];
                const ratingChange = isChallenger ? c.rating_change_challenger : c.rating_change_challenged;
                const myScore = isChallenger ? c.challenger_sets_won : c.challenged_sets_won;
                const oppScore = isChallenger ? c.challenged_sets_won : c.challenger_sets_won;

                return (
                  <div key={c.id} className="glass-card px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${won ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {won ? "V" : "D"}
                      </span>
                      <div>
                        <span className="text-sm font-medium text-foreground">vs {opponent || "?"}</span>
                        <span className="text-xs text-muted-foreground ml-2">{myScore} - {oppScore}</span>
                      </div>
                    </div>
                    {ratingChange != null && ratingChange !== 0 && (
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${ratingChange > 0 ? "text-success" : "text-destructive"}`}>
                        {ratingChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {ratingChange > 0 ? "+" : ""}{ratingChange}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Tournament History */}
        <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2 animate-slide-up stagger-2">
          <Trophy className="w-4 h-4 text-primary" /> Torneos ({Object.keys(matchesByTournament).length})
        </h2>
        {Object.keys(matchesByTournament).length === 0 ? (
          <div className="glass-card p-6 text-center text-muted-foreground text-sm mb-6">Sin torneos.</div>
        ) : (
          <div className="space-y-2 mb-6">
            {Object.entries(matchesByTournament).map(([tId, tMatches]) => {
              const tInfo = tournamentsMap[tId];
              const tWins = tMatches.filter(m => m.winner_id === id).length;
              const tLosses = tMatches.length - tWins;
              return (
                <Link key={tId} to={`/torneo/${tId}`} className="glass-card px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors block">
                  <div>
                    <span className="text-sm font-medium text-foreground">{tInfo?.name || "Torneo"}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {tInfo?.status === "finished" ? "Finalizado" : tInfo?.status === "in_progress" ? "En Curso" : "Inscripción"}
                    </span>
                  </div>
                  {tMatches.length > 0 && (
                    <span className="text-xs text-muted-foreground">{tWins}V - {tLosses}D</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Match History */}
        <h2 className="font-heading font-semibold text-foreground mb-3 animate-slide-up stagger-3">Historial de Partidos</h2>
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
              const setScores = m.set_scores as Array<{p1: number; p2: number}> | null;
              const setDetail = setScores ? setScores.map(s => isP1 ? `${s.p1}-${s.p2}` : `${s.p2}-${s.p1}`).join(", ") : "";

              return (
                <div key={m.id} className="glass-card px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${won ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {won ? "V" : "D"}
                    </span>
                    <div>
                      <span className="text-sm font-medium text-foreground">vs {opponent || "TBD"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{myScore} - {oppScore}</span>
                      {setDetail && <span className="text-xs text-muted-foreground ml-1">({setDetail})</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {ratingChange != null && ratingChange !== 0 && (
                      <span className={`text-xs font-medium flex items-center gap-0.5 ${ratingChange > 0 ? "text-success" : "text-destructive"}`}>
                        {ratingChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {ratingChange > 0 ? "+" : ""}{ratingChange}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{tournamentsMap[m.tournament_id]?.name || ""}</span>
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
