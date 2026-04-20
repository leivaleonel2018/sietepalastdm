import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { authAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import PlayerAvatar from "@/components/PlayerAvatar";
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Lock, Swords, Camera, Award, Star, Shield, Flame, Crown, Zap, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface Player {
  id: string;
  full_name: string;
  dni: string;
  rating: number;
  created_at: string;
  avatar_url: string | null;
}

interface ProfileSetScore {
  p1: number;
  p2: number;
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
  set_scores: ProfileSetScore[] | null;
  created_at: string;
}

interface TournamentInfo { id: string; name: string; status: string; }

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  set_scores: ProfileSetScore[] | null;
  challenger_sets_won: number | null;
  challenged_sets_won: number | null;
  winner_id: string | null;
  rating_change_challenger: number | null;
  rating_change_challenged: number | null;
  created_at: string;
}

interface BadgeInfo {
  id: string;
  badge_id: string;
  tournament_id: string | null;
  created_at: string;
  badges: { name: string; description: string | null; icon_url: string | null; type: string } | null;
}

// All possible badges for locked display
interface Badge {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  type: string;
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
  const [earnedBadges, setEarnedBadges] = useState<BadgeInfo[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const isOwnProfile = loggedPlayer?.id === id;
  const canChallenge = loggedPlayer && !isOwnProfile;

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      const [pRes, m1Res, m2Res, regsRes, cRes, pbRes, bRes] = await Promise.all([
        supabase.from("players").select("*").eq("id", id).single(),
        supabase.from("matches").select("*").eq("player1_id", id).order("created_at", { ascending: false }),
        supabase.from("matches").select("*").eq("player2_id", id).order("created_at", { ascending: false }),
        supabase.from("tournament_registrations").select("tournament_id").eq("player_id", id),
        supabase.from("challenges").select("*").or(`challenger_id.eq.${id},challenged_id.eq.${id}`).order("created_at", { ascending: false }),
        supabase.from("player_badges").select("*, badges(name, description, icon_url, type)").eq("player_id", id).order("created_at", { ascending: false }),
        supabase.from("badges").select("*").order("created_at"),
      ]);

      setPlayer(pRes.data as Player | null);
      setChallenges((cRes.data || []) as Challenge[]);
      setEarnedBadges((pbRes.data || []) as unknown as BadgeInfo[]);
      setAllBadges((bRes.data || []) as Badge[]);

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
    if (result.error) toast.error(result.error);
    else toast.success("¡Desafío enviado!");
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setAvatarUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${id}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Error subiendo imagen"); setAvatarUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    // Update via auth action
    const result = await authAction("update_avatar", {
      player_id: id,
      avatar_url: urlData.publicUrl + "?t=" + Date.now(),
      player_token: playerToken,
    });
    setAvatarUploading(false);
    if (result.error) { toast.error(result.error); return; }
    toast.success("Foto actualizada");
    setPlayer(prev => prev ? { ...prev, avatar_url: urlData.publicUrl + "?t=" + Date.now() } : prev);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) { toast.error("Las contraseñas no coinciden"); return; }
    if (pwForm.newPw.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setPwLoading(true);
    const result = await authAction("change_password", { player_id: id, current_password: pwForm.current, new_password: pwForm.newPw });
    setPwLoading(false);
    if (result.error) toast.error(result.error);
    else { toast.success("Contraseña actualizada"); setPwForm({ current: "", newPw: "", confirm: "" }); setShowPasswordForm(false); }
  };

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Cargando...</div></div>;
  if (!player) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Jugador no encontrado.</div></div>;

  const completedChallenges = challenges.filter(c => c.status === "completed");
  const earnedBadgeIds = new Set(earnedBadges.map(b => b.badge_id));

  const matchWins = matches.filter(m => m.winner_id === id).length;
  const matchLosses = matches.length - matchWins;
  const challengeWins = completedChallenges.filter(c => c.winner_id === id).length;
  const challengeLosses = completedChallenges.length - challengeWins;
  const wins = matchWins + challengeWins;
  const losses = matchLosses + challengeLosses;
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  let currentStreak = 0;
  for (const m of matches) { if (m.winner_id === id) currentStreak++; else break; }

  const matchesByTournament: Record<string, Match[]> = {};
  matches.forEach(m => { if (!matchesByTournament[m.tournament_id]) matchesByTournament[m.tournament_id] = []; matchesByTournament[m.tournament_id].push(m); });
  tournamentIds.forEach(tId => { if (!matchesByTournament[tId]) matchesByTournament[tId] = []; });

  const renderBadgeIcon = (iconStr: string | null) => {
    const s = iconStr?.toLowerCase();
    // Legacy Lucide name mappings
    if (s === "star") return <Star className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />;
    if (s === "shield") return <Shield className="w-8 h-8 text-slate-300 drop-shadow-[0_0_8px_rgba(203,213,225,0.5)]" />;
    if (s === "medal") return <Award className="w-8 h-8 text-[#cd7f32] drop-shadow-[0_0_8px_rgba(205,127,50,0.5)]" />;
    if (s === "flame") return <Flame className="w-8 h-8 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" />;
    if (s === "crown") return <Crown className="w-8 h-8 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />;
    if (s === "zap") return <Zap className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />;
    if (s === "target") return <Target className="w-8 h-8 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />;
    // Emoji-to-Lucide hero mappings for new badge system
    if (iconStr === "🔰") return <Shield className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]" />;
    if (iconStr === "🔥") return <Flame className="w-8 h-8 text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]" />;
    if (iconStr === "🏅") return <Award className="w-8 h-8 text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]" />;
    if (iconStr === "🛡️") return <Shield className="w-8 h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(96,165,250,0.6)]" />;
    if (iconStr === "🎖️") return <Award className="w-8 h-8 text-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.6)]" />;
    if (iconStr === "👑") return <Crown className="w-8 h-8 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]" />;
    if (iconStr === "⚡") return <Zap className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]" />;
    if (iconStr === "🔱") return <Trophy className="w-8 h-8 text-teal-400 drop-shadow-[0_0_10px_rgba(45,212,191,0.6)]" />;
    if (iconStr === "⚔️") return <Swords className="w-8 h-8 text-red-400 drop-shadow-[0_0_10px_rgba(248,113,113,0.6)]" />;
    if (iconStr === "🧠") return <Star className="w-8 h-8 text-violet-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.6)]" />;
    if (iconStr === "💎") return <Crown className="w-8 h-8 text-sky-300 drop-shadow-[0_0_12px_rgba(125,211,252,0.7)]" />;
    // Fallback: render as emoji text
    return <span className="text-3xl drop-shadow-md">{iconStr || "🎖️"}</span>;
  };

  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Link to="/rankings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Rankings
        </Link>

        {/* Player Header */}
        <div className="glass-card p-6 mb-6 animate-slide-up">
          <div className="flex items-start gap-4 mb-4">
            <div className="relative group">
              <PlayerAvatar name={player.full_name} avatarUrl={player.avatar_url} size="lg" />
              {isOwnProfile && (
                <label className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" disabled={avatarUploading} />
                </label>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="font-heading text-2xl font-bold text-foreground mb-1">{player.full_name}</h1>
                  <p className="text-sm text-muted-foreground">
                    Miembro desde {new Date(player.created_at).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canChallenge && (
                    <Button onClick={handleChallenge} disabled={challengeLoading} size="sm" className="gap-1.5 shadow-sm">
                      <Swords className="w-4 h-4" />
                      {challengeLoading ? "Enviando..." : "Desafiar"}
                    </Button>
                  )}
                  {isOwnProfile && (
                    <button onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
                      <Lock className="w-3 h-3" /> Cambiar clave
                    </button>
                  )}
                </div>
              </div>
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
          {currentStreak > 1 && <p className="text-sm text-muted-foreground mt-3">🔥 Racha actual: {currentStreak} victorias</p>}

          {showPasswordForm && isOwnProfile && (
            <form onSubmit={handlePasswordChange} className="mt-4 p-4 rounded-lg bg-muted/30 space-y-2.5">
              <div><Label className="text-xs">Contraseña actual</Label><Input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required /></div>
              <div><Label className="text-xs">Nueva contraseña</Label><Input type="password" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} required minLength={6} /></div>
              <div><Label className="text-xs">Confirmar</Label><Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required /></div>
              <Button type="submit" size="sm" disabled={pwLoading}>{pwLoading ? "Guardando..." : "Guardar"}</Button>
            </form>
          )}
        </div>

        {/* Badges */}
        <div className="glass-card p-5 mb-6 animate-slide-up stagger-1">
          <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" /> Insignias
          </h2>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {allBadges.filter(b => b.type !== "tournament").map(badge => {
              const earned = earnedBadges.find(eb => eb.badge_id === badge.id);
              const isEarned = !!earned;
              return (
                <Tooltip key={badge.id}>
                  <TooltipTrigger asChild>
                    <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-center p-2 transition-all duration-300 ${
                      isEarned
                        ? "bg-gradient-to-br from-background to-muted border border-border/50 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)] hover:scale-105 cursor-default relative overflow-hidden group"
                        : "bg-muted/30 border border-border/20 opacity-40 grayscale cursor-help"
                    }`}>
                      {isEarned && <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}
                      <div className="mb-2 transition-transform duration-300 group-hover:-translate-y-1">
                        {renderBadgeIcon(badge.icon_url)}
                      </div>
                      <span className="text-[10px] font-bold tracking-wide text-foreground leading-tight uppercase relative z-10">{badge.name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">{badge.name}</p>
                    <p className="text-xs text-muted-foreground">{badge.description}</p>
                    {isEarned && earned && <p className="text-xs text-primary mt-1">Obtenida el {new Date(earned.created_at).toLocaleDateString("es-AR")}</p>}
                    {!isEarned && <p className="text-xs text-muted-foreground mt-1">🔒 No obtenida</p>}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {/* Tournament champion badges */}
            {earnedBadges
              .filter(eb => eb.badges?.type === "tournament")
              .map(eb => (
                <Tooltip key={eb.id}>
                  <TooltipTrigger asChild>
                    <div className="aspect-square rounded-2xl flex flex-col items-center justify-center text-center p-2 bg-gradient-to-br from-accent/20 to-background border border-accent/30 shadow-[0_4px_20px_-4px_rgba(var(--accent),0.3)] hover:scale-105 transition-all duration-300 cursor-default relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-tr from-accent/0 via-accent/10 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="mb-2 transition-transform duration-300 group-hover:-translate-y-1">
                        <Trophy className="w-8 h-8 text-accent drop-shadow-[0_0_8px_rgba(var(--accent),0.5)]" />
                      </div>
                      <span className="text-[10px] font-bold tracking-wide text-foreground leading-tight uppercase relative z-10">Campeón</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-semibold">🏆 Campeón de torneo</p>
                    <p className="text-xs text-muted-foreground">{eb.badges?.description || "Ganó un torneo"}</p>
                    <p className="text-xs text-primary mt-1">{new Date(eb.created_at).toLocaleDateString("es-AR")}</p>
                  </TooltipContent>
                </Tooltip>
              ))
            }
          </div>
        </div>

        {/* Challenge History */}
        {completedChallenges.length > 0 && (
          <>
            <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2 animate-slide-up stagger-2">
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
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${won ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{won ? "V" : "D"}</span>
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
        <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2 animate-slide-up stagger-3">
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
                  {tMatches.length > 0 && <span className="text-xs text-muted-foreground">{tWins}V - {tLosses}D</span>}
                </Link>
              );
            })}
          </div>
        )}

        {/* Match History */}
        <h2 className="font-heading font-semibold text-foreground mb-3 animate-slide-up stagger-4">Historial de Partidos</h2>
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
              const setScores = m.set_scores;
              const setDetail = Array.isArray(setScores) ? setScores.map(s => isP1 ? `${s?.p1 ?? 0}-${s?.p2 ?? 0}` : `${s?.p2 ?? 0}-${s?.p1 ?? 0}`).join(", ") : "";

              return (
                <div key={m.id} className="glass-card px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${won ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{won ? "V" : "D"}</span>
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
