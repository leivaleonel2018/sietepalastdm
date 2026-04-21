import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { authAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import PlayerAvatar from "@/components/PlayerAvatar";
import { ArrowLeft, TrendingUp, TrendingDown, Trophy, Lock, Swords, Camera, Award, Star, Shield, Flame, Crown, Zap, Target, Share2, Activity, Medal as MedalIcon, Edit3, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ScrollReveal } from "@/components/ScrollReveal";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts";
import html2canvas from "html2canvas";

interface PlayerAttributes {
  attack: number;
  defense: number;
  serve: number;
  control: number;
  speed: number;
  mental: number;
}

interface Player {
  id: string;
  full_name: string;
  dni: string;
  rating: number;
  created_at: string;
  avatar_url: string | null;
  attributes?: PlayerAttributes | null;
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

  // H2H state
  const [h2hStats, setH2hStats] = useState({ wins: 0, losses: 0, matches: [] as Match[] });
  
  // Rating History state
  const [ratingHistory, setRatingHistory] = useState<{match: number, rating: number}[]>([]);
  const [bestRank, setBestRank] = useState<number | null>(null);
  const [worstRank, setWorstRank] = useState<number | null>(null);

  // Radar attributes (from DB)
  const [playerAttributes, setPlayerAttributes] = useState<any[]>([]);
  const [editingAttributes, setEditingAttributes] = useState(false);
  const [editAttrs, setEditAttrs] = useState<PlayerAttributes>({ attack: 70, defense: 70, serve: 70, control: 70, speed: 70, mental: 70 });
  const [savingAttrs, setSavingAttrs] = useState(false);
  const profileCardRef = useRef<HTMLDivElement>(null);

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
      setChallenges((cRes.data || []) as unknown as Challenge[]);
      setEarnedBadges((pbRes.data || []) as unknown as BadgeInfo[]);
      setAllBadges((bRes.data || []) as Badge[]);

      const allMatches = [...(m1Res.data || []), ...(m2Res.data || [])] as unknown as Match[];
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

      // Calculate Rating History (backwards)
      if (pRes.data) {
        const p = pRes.data as Player;
        let currentRating = p.rating;
        let minRank = currentRating;
        let maxRank = currentRating;
        const history: {match: number, rating: number}[] = [{ match: allMatches.length, rating: currentRating }];
        
        for (let i = 0; i < allMatches.length; i++) {
          const m = allMatches[i];
          const isP1 = m.player1_id === id;
          const change = isP1 ? m.rating_change_p1 : m.rating_change_p2;
          if (change != null) {
            currentRating = currentRating - change;
            if (currentRating > maxRank) maxRank = currentRating;
            if (currentRating < minRank) minRank = currentRating;
            history.unshift({ match: allMatches.length - 1 - i, rating: currentRating });
          }
        }
        setRatingHistory(history);
        setBestRank(maxRank);
        setWorstRank(minRank);

        // Load attributes from DB or use defaults
        const attrs: PlayerAttributes = (p as any).attributes || { attack: 70, defense: 70, serve: 70, control: 70, speed: 70, mental: 70 };
        setEditAttrs(attrs);
        setPlayerAttributes([
          { subject: 'Ataque', A: attrs.attack, fullMark: 100 },
          { subject: 'Defensa', A: attrs.defense, fullMark: 100 },
          { subject: 'Saque', A: attrs.serve, fullMark: 100 },
          { subject: 'Control', A: attrs.control, fullMark: 100 },
          { subject: 'Velocidad', A: attrs.speed, fullMark: 100 },
          { subject: 'Mental', A: attrs.mental, fullMark: 100 },
        ]);
      }

      // Calculate H2H if logged in and not own profile
      if (loggedPlayer && loggedPlayer.id !== id) {
        const h2hMatches = allMatches.filter(m => 
          (m.player1_id === loggedPlayer.id && m.player2_id === id) || 
          (m.player2_id === loggedPlayer.id && m.player1_id === id)
        );
        let w = 0; let l = 0;
        h2hMatches.forEach(m => {
          if (m.winner_id === loggedPlayer.id) w++;
          else if (m.winner_id === id) l++;
        });
        setH2hStats({ wins: w, losses: l, matches: h2hMatches });
      }

      setLoading(false);
    };
    fetchAll();
  }, [id]);

  const handleChallenge = async () => {
    if (!player || !loggedPlayer) return;
    setChallengeLoading(true);
    const result = await authAction("create_challenge", {
      challenger_id: loggedPlayer.id,
      challenged_id: player.id,
      player_token: playerToken,
    });
    setChallengeLoading(false);
    if (result.error) toast.error(result.error);
    else toast.success("¡Desafío enviado!");
  };

  const handleGeneratePoster = async () => {
    if (!profileCardRef.current || !player) return;
    toast.info("Generando póster...");
    try {
      const canvas = await html2canvas(profileCardRef.current, {
        backgroundColor: "#0d1424", // Dark background to match theme
        scale: 2,
        useCORS: true,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `tdm-stats-${player.full_name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("¡Póster generado exitosamente!");
    } catch (err) {
      console.error(err);
      toast.error("Error al generar el póster");
    }
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
    if (iconStr === "🏔️") return <Trophy className="w-8 h-8 text-slate-300 drop-shadow-[0_0_10px_rgba(148,163,184,0.6)]" />;
    if (iconStr === "🌌") return <Star className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_12px_rgba(129,140,248,0.7)]" />;
    if (iconStr === "🏰") return <Crown className="w-8 h-8 text-amber-500 drop-shadow-[0_0_12px_rgba(245,158,11,0.7)]" />;
    if (iconStr === "☄️") return <Flame className="w-8 h-8 text-rose-400 drop-shadow-[0_0_12px_rgba(251,113,133,0.7)]" />;
    if (iconStr === "🏟️") return <Award className="w-8 h-8 text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]" />;
    if (iconStr === "🌋") return <Flame className="w-8 h-8 text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]" />;
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
        <div ref={profileCardRef} className="glass-card p-6 mb-6 animate-slide-up relative overflow-hidden">
          {/* Subtle background glow for the poster */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2" />
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
                  <button onClick={handleGeneratePoster} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <Share2 className="w-3 h-3" /> Compartir Stats
                  </button>
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
          
          <div className="flex items-center gap-4 mt-4">
            {currentStreak > 1 && <p className="text-sm font-medium text-orange-500 bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">🔥 Racha actual: {currentStreak} victorias</p>}
            {bestRank !== null && <p className="text-xs text-muted-foreground">📈 Mejor Ranking: <span className="text-foreground font-semibold">{bestRank}</span></p>}
          </div>

          {showPasswordForm && isOwnProfile && (
            <form onSubmit={handlePasswordChange} className="mt-4 p-4 rounded-lg bg-muted/30 space-y-2.5">
              <div><Label className="text-xs">Contraseña actual</Label><Input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required /></div>
              <div><Label className="text-xs">Nueva contraseña</Label><Input type="password" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} required minLength={6} /></div>
              <div><Label className="text-xs">Confirmar</Label><Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required /></div>
              <Button type="submit" size="sm" disabled={pwLoading}>{pwLoading ? "Guardando..." : "Guardar"}</Button>
            </form>
          )}
        </div>

        {/* H2H vs Logged Player */}
        {loggedPlayer && loggedPlayer.id !== id && (
          <ScrollReveal direction="up" delay={0.1}>
            <div className="glass-card p-5 mb-6 bg-primary/5 border-primary/20">
              <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Tu Historial vs {player.full_name.split(' ')[0]}
              </h2>
              <div className="flex items-center justify-center gap-8 py-2">
                <div className="text-center">
                  <div className="text-3xl font-heading font-bold text-success">{h2hStats.wins}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Tus Victorias</div>
                </div>
                <div className="text-xl font-bold text-muted-foreground">vs</div>
                <div className="text-center">
                  <div className="text-3xl font-heading font-bold text-destructive">{h2hStats.losses}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest">Tus Derrotas</div>
                </div>
              </div>
              {h2hStats.matches.length > 0 && (
                <p className="text-center text-xs text-muted-foreground mt-2">
                  Último partido: {new Date(h2hStats.matches[0].created_at).toLocaleDateString("es-AR")}
                </p>
              )}
            </div>
          </ScrollReveal>
        )}

        {/* Radar & Rating History Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <ScrollReveal direction="up" delay={0.2}>
            <div className="glass-card p-5 h-full">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-heading font-semibold text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> Atributos
                </h2>
                {isOwnProfile && !editingAttributes && (
                  <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" onClick={() => setEditingAttributes(true)}>
                    <Edit3 className="w-3 h-3" /> Editar
                  </Button>
                )}
                {isOwnProfile && editingAttributes && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" disabled={savingAttrs} onClick={() => {
                      setEditingAttributes(false);
                      // Reset to current DB values
                      const attrs: PlayerAttributes = (player as any).attributes || { attack: 70, defense: 70, serve: 70, control: 70, speed: 70, mental: 70 };
                      setEditAttrs(attrs);
                      setPlayerAttributes([
                        { subject: 'Ataque', A: attrs.attack, fullMark: 100 },
                        { subject: 'Defensa', A: attrs.defense, fullMark: 100 },
                        { subject: 'Saque', A: attrs.serve, fullMark: 100 },
                        { subject: 'Control', A: attrs.control, fullMark: 100 },
                        { subject: 'Velocidad', A: attrs.speed, fullMark: 100 },
                        { subject: 'Mental', A: attrs.mental, fullMark: 100 },
                      ]);
                    }}>
                      <X className="w-3 h-3" /> Cancelar
                    </Button>
                    <Button size="sm" variant="default" className="text-xs gap-1 h-7" disabled={savingAttrs} onClick={async () => {
                      setSavingAttrs(true);
                      const result = await authAction("update_attributes", {
                        player_id: loggedPlayer!.id,
                        player_token: playerToken,
                        attributes: editAttrs,
                      });
                      setSavingAttrs(false);
                      if (result?.error) { toast.error(result.error); return; }
                      toast.success("Atributos guardados");
                      setEditingAttributes(false);
                      // Update local player object
                      if (player) (player as any).attributes = { ...editAttrs };
                    }}>
                      <Save className="w-3 h-3" /> {savingAttrs ? "..." : "Guardar"}
                    </Button>
                  </div>
                )}
              </div>

              {!editingAttributes ? (
                <div className="h-64 w-full relative -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={playerAttributes}>
                      <PolarGrid stroke="hsl(var(--muted-foreground)/0.3)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--foreground))", fontSize: 10 }} />
                      <Radar name={player.full_name} dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="space-y-3 py-2">
                  {[
                    { key: 'attack', label: 'Ataque', emoji: '⚔️' },
                    { key: 'defense', label: 'Defensa', emoji: '🛡️' },
                    { key: 'serve', label: 'Saque', emoji: '🎯' },
                    { key: 'control', label: 'Control', emoji: '🧠' },
                    { key: 'speed', label: 'Velocidad', emoji: '⚡' },
                    { key: 'mental', label: 'Mental', emoji: '💎' },
                  ].map(attr => (
                    <div key={attr.key} className="flex items-center gap-3">
                      <span className="text-sm w-6">{attr.emoji}</span>
                      <span className="text-xs text-muted-foreground w-20">{attr.label}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={(editAttrs as any)[attr.key]}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          const newAttrs = { ...editAttrs, [attr.key]: val };
                          setEditAttrs(newAttrs);
                          setPlayerAttributes([
                            { subject: 'Ataque', A: newAttrs.attack, fullMark: 100 },
                            { subject: 'Defensa', A: newAttrs.defense, fullMark: 100 },
                            { subject: 'Saque', A: newAttrs.serve, fullMark: 100 },
                            { subject: 'Control', A: newAttrs.control, fullMark: 100 },
                            { subject: 'Velocidad', A: newAttrs.speed, fullMark: 100 },
                            { subject: 'Mental', A: newAttrs.mental, fullMark: 100 },
                          ]);
                        }}
                        className="flex-1 accent-[hsl(var(--primary))] h-2 cursor-pointer"
                      />
                      <span className="text-xs font-heading font-bold text-primary w-8 text-right">{(editAttrs as any)[attr.key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" delay={0.3}>
            <div className="glass-card p-5 h-full">
              <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Evolución de Rating
              </h2>
              <div className="h-64 w-full">
                {ratingHistory.length > 1 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ratingHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="match" hide />
                      <YAxis domain={['auto', 'auto']} width={40} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      <Line type="monotone" dataKey="rating" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: "hsl(var(--primary))" }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No hay suficientes datos.</div>
                )}
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Vitrina de Trofeos (Trophy Room) & Badges */}
        <ScrollReveal direction="up" delay={0.4}>
          <div className="glass-card p-5 mb-6">
            <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
              <MedalIcon className="w-5 h-5 text-primary" /> Vitrina y Logros
            </h2>
            
            {/* Tournament champion badges */}
            {earnedBadges.filter(eb => eb.badges?.type === "tournament").length > 0 && (
              <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
                {earnedBadges
                  .filter(eb => eb.badges?.type === "tournament")
                  .map(eb => (
                    <Tooltip key={eb.id}>
                      <TooltipTrigger asChild>
                        <div className="min-w-[120px] rounded-2xl flex flex-col items-center justify-center text-center p-4 bg-gradient-to-b from-yellow-500/20 to-card border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.15)] hover:scale-105 transition-all duration-300 cursor-default relative group">
                          <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/0 via-yellow-500/10 to-yellow-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                          <Trophy className="w-12 h-12 text-yellow-500 mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)]" />
                          <span className="text-[10px] font-bold tracking-widest text-yellow-500/80 uppercase">Campeón</span>
                          <span className="text-xs font-semibold text-foreground mt-1 line-clamp-1">{tournamentsMap[eb.tournament_id || ""]?.name || "Torneo"}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="font-semibold">🏆 Campeón</p>
                        <p className="text-xs text-muted-foreground">{tournamentsMap[eb.tournament_id || ""]?.name}</p>
                        <p className="text-xs text-primary mt-1">{new Date(eb.created_at).toLocaleDateString("es-AR")}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))
                }
              </div>
            )}

            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Insignias</h3>
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
              {allBadges.filter(b => b.type !== "tournament").map(badge => {
                const earned = earnedBadges.find(eb => eb.badge_id === badge.id);
                const isEarned = !!earned;
                return (
                  <Tooltip key={badge.id}>
                    <TooltipTrigger asChild>
                      <div className={`aspect-square rounded-2xl flex flex-col items-center justify-center text-center p-2 transition-all duration-300 ${
                        isEarned
                          ? "bg-card/80 border border-white/10 shadow-lg hover:scale-110 cursor-default relative overflow-hidden group hover:border-primary/50"
                          : "bg-background/40 border border-border/20 opacity-30 grayscale cursor-help"
                      }`}>
                        {isEarned && <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>}
                        <div className="mb-1 transition-transform duration-300 group-hover:-translate-y-1 scale-110">
                          {renderBadgeIcon(badge.icon_url)}
                        </div>
                        <span className="text-[9px] font-bold tracking-wider text-foreground leading-tight uppercase relative z-10">{badge.name}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-semibold">{badge.name}</p>
                      <p className="text-xs text-muted-foreground">{badge.description}</p>
                      {isEarned && earned && <p className="text-xs text-primary mt-1">Obtenida el {new Date(earned.created_at).toLocaleDateString("es-AR")}</p>}
                      {!isEarned && <p className="text-xs text-muted-foreground mt-1">🔒 Bloqueada</p>}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        {/* Challenge History */}
        {completedChallenges.length > 0 && (
          <ScrollReveal direction="up" delay={0.1}>
            <div className="mb-8">
              <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
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
                    <div key={c.id} className="glass-card px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${won ? "bg-success/20 text-success border border-success/30" : "bg-muted/50 text-muted-foreground border border-white/5"}`}>{won ? "V" : "D"}</span>
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
            </div>
          </ScrollReveal>
        )}

        {/* Tournament History */}
        <ScrollReveal direction="up" delay={0.2}>
          <div className="mb-8">
            <h2 className="font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
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
                    <Link key={tId} to={`/torneo/${tId}`} className="glass-card px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors block group">
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{tInfo?.name || "Torneo"}</span>
                          <span className="text-[10px] uppercase tracking-widest text-muted-foreground ml-2 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                            {tInfo?.status === "finished" ? "Finalizado" : tInfo?.status === "in_progress" ? "En Curso" : "Inscripción"}
                          </span>
                        </div>
                        {tMatches.length > 0 && <span className="text-xs font-bold text-muted-foreground bg-black/20 px-2 py-1 rounded">{tWins}V - {tLosses}D</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollReveal>

        {/* Match History */}
        <ScrollReveal direction="up" delay={0.3}>
          <div>
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
                  const setScores = m.set_scores;
                  const setDetail = Array.isArray(setScores) ? setScores.map(s => isP1 ? `${s?.p1 ?? 0}-${s?.p2 ?? 0}` : `${s?.p2 ?? 0}-${s?.p1 ?? 0}`).join(", ") : "";

                  return (
                    <div key={m.id} className="glass-card px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${won ? "bg-success/20 text-success border border-success/30" : "bg-muted/50 text-muted-foreground border border-white/5"}`}>{won ? "V" : "D"}</span>
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
                        <span className="text-xs text-muted-foreground max-w-[100px] truncate">{tournamentsMap[m.tournament_id]?.name || ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </div>
  );
}
