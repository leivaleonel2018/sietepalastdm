import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trophy, Users, Star, ArrowRight, Swords, BookOpen, Newspaper, Crown, Medal, TrendingUp, Flame, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

interface Player {
  id: string;
  full_name: string;
  rating: number;
  avatar_url: string | null;
}

interface RecentMatch {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  set_scores: any;
  created_at: string;
  round: string | null;
  tournament_id: string;
}

interface ActiveTournament {
  id: string;
  name: string;
  format: string;
  status: string;
}

interface BracketMatch {
  id: string;
  round: string | null;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  match_order: number | null;
}

const stripHtml = (str: string) => str.replace(/<[^>]*>/g, "").trim();

// Count-up hook
function useCountUp(target: number | null, duration = 1200) {
  const [value, setValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target === null || hasAnimated.current) return;
    hasAnimated.current = true;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  return target === null ? "–" : value;
}

// Sparkline component
function Sparkline({ playerId, currentRating }: { playerId: string; currentRating: number }) {
  // Generate deterministic pseudo-random sparkline from player id
  const points: number[] = [];
  let seed = 0;
  for (let i = 0; i < playerId.length; i++) seed = ((seed << 5) - seed + playerId.charCodeAt(i)) | 0;
  for (let i = 0; i < 5; i++) {
    seed = (seed * 16807 + 0) % 2147483647;
    const variation = ((seed % 60) - 30);
    points.push(Math.max(0, currentRating + variation - (4 - i) * 5));
  }
  points[4] = currentRating;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 40, h = 16;
  const d = points.map((p, i) => {
    const x = (i / 4) * w;
    const y = h - ((p - min) / range) * h;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const trending = points[4] >= points[0];

  return (
    <>
      <svg width={w} height={h} className="hidden md:block flex-shrink-0" viewBox={`0 0 ${w} ${h}`}>
        <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`md:hidden text-xs font-medium ${trending ? "text-green-600" : "text-red-500"}`}>
        {trending ? "↑" : "↓"}
      </span>
    </>
  );
}

// Paddle SVG illustration
function PaddleIllustration() {
  return (
    <svg viewBox="0 0 300 300" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Paddle */}
      <g className="animate-float">
        <ellipse cx="150" cy="120" rx="70" ry="85" fill="hsl(var(--primary))" opacity="0.15" stroke="hsl(var(--primary))" strokeWidth="2.5" />
        <ellipse cx="150" cy="120" rx="55" ry="68" fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
        <rect x="143" y="200" width="14" height="65" rx="5" fill="hsl(var(--primary))" opacity="0.25" stroke="hsl(var(--primary))" strokeWidth="2" />
        <rect x="139" y="258" width="22" height="10" rx="4" fill="hsl(var(--primary))" opacity="0.15" />
      </g>
      {/* Ball */}
      <g className="animate-float stagger-2">
        <circle cx="230" cy="80" r="18" fill="hsl(var(--accent))" opacity="0.2" stroke="hsl(var(--accent))" strokeWidth="2" />
        <ellipse cx="230" cy="80" rx="18" ry="1" fill="none" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.3" />
        <circle cx="224" cy="74" r="4" fill="hsl(var(--accent))" opacity="0.15" />
      </g>
      {/* Motion lines */}
      <line x1="255" y1="68" x2="275" y2="58" stroke="hsl(var(--accent))" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
      <line x1="255" y1="80" x2="278" y2="80" stroke="hsl(var(--accent))" strokeWidth="1.5" opacity="0.2" strokeLinecap="round" />
      <line x1="255" y1="92" x2="272" y2="100" stroke="hsl(var(--accent))" strokeWidth="1.5" opacity="0.3" strokeLinecap="round" />
      {/* Stars */}
      <circle cx="80" cy="60" r="2" fill="hsl(var(--primary))" opacity="0.3" />
      <circle cx="260" cy="180" r="2.5" fill="hsl(var(--primary))" opacity="0.2" />
      <circle cx="100" cy="240" r="1.5" fill="hsl(var(--accent))" opacity="0.25" />
    </svg>
  );
}

export default function Index() {
  const { player } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [topPlayers, setTopPlayers] = useState<Player[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, Player>>({});
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null);
  const [totalMatches, setTotalMatches] = useState<number | null>(null);
  const [activeTournament, setActiveTournament] = useState<ActiveTournament | null>(null);
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);

  const animatedPlayers = useCountUp(totalPlayers);
  const animatedMatches = useCountUp(totalMatches);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [newsRes, topRes, matchesRes, playersCountRes, matchesCountRes, tournamentRes] = await Promise.all([
          supabase.from("news").select("*").order("created_at", { ascending: false }).limit(6),
          supabase.from("players").select("id, full_name, rating, avatar_url").order("rating", { ascending: false }).limit(5),
          supabase.from("matches").select("*").order("created_at", { ascending: false }).limit(10),
          supabase.from("players").select("*", { count: "exact", head: true }),
          supabase.from("matches").select("*", { count: "exact", head: true }),
          supabase.from("tournaments").select("id, name, format, status").in("status", ["in_progress", "group_stage", "knockout"]).order("created_at", { ascending: false }).limit(1),
        ]);

        setNews((newsRes.data || []) as NewsItem[]);
        setLoadingNews(false);

        setTopPlayers((topRes.data || []) as Player[]);
        setLoadingRanking(false);

        setRecentMatches((matchesRes.data || []) as RecentMatch[]);
        setTotalPlayers(playersCountRes.count ?? null);
        setTotalMatches(matchesCountRes.count ?? null);

        // Active tournament bracket
        const at = (tournamentRes.data || [])[0] as ActiveTournament | undefined;
        if (at) {
          setActiveTournament(at);
          const { data: bm } = await supabase
            .from("matches")
            .select("id, round, player1_id, player2_id, player1_score, player2_score, winner_id, match_order")
            .eq("tournament_id", at.id)
            .order("match_order", { ascending: true });
          setBracketMatches((bm || []) as BracketMatch[]);
        }

        // Build players map for matches
        const playerIds = new Set<string>();
        (matchesRes.data || []).forEach((m: any) => {
          if (m.player1_id) playerIds.add(m.player1_id);
          if (m.player2_id) playerIds.add(m.player2_id);
        });
        // Also add bracket match player ids
        if (at) {
          ((await supabase.from("matches").select("player1_id, player2_id").eq("tournament_id", at.id)).data || []).forEach((m: any) => {
            if (m.player1_id) playerIds.add(m.player1_id);
            if (m.player2_id) playerIds.add(m.player2_id);
          });
        }
        if (playerIds.size > 0) {
          const { data: pData } = await supabase.from("players").select("id, full_name, rating, avatar_url").in("id", Array.from(playerIds));
          const map: Record<string, Player> = {};
          (pData || []).forEach((p: any) => { map[p.id] = p; });
          setPlayersMap(map);
        }
        setLoadingMatches(false);
      } catch (err) {
        console.error("Error fetching index data:", err);
      } finally {
        setLoadingNews(false);
        setLoadingRanking(false);
        setLoadingMatches(false);
      }
    };
    fetchAll();
  }, []);

  // Detect hot streaks from recent matches
  const getStreak = useCallback((playerId: string): number => {
    let streak = 0;
    for (const m of recentMatches) {
      if (m.player1_id !== playerId && m.player2_id !== playerId) continue;
      if (m.winner_id === playerId) streak++;
      else break;
    }
    return streak;
  }, [recentMatches]);

  // Group bracket matches by round
  const bracketRounds = bracketMatches.reduce<Record<string, BracketMatch[]>>((acc, m) => {
    const r = m.round || "Ronda";
    if (!acc[r]) acc[r] = [];
    acc[r].push(m);
    return acc;
  }, {});

  const features = [
    { icon: <Trophy className="w-5 h-5" />, title: "Torneos", desc: "Fase de grupos, eliminación directa, individuales y dobles.", color: "text-primary", link: "/torneos" },
    { icon: <Users className="w-5 h-5" />, title: "Rankings", desc: "Sistema de rating basado en rendimiento partido a partido.", color: "text-primary", link: "/rankings" },
    { icon: <Swords className="w-5 h-5" />, title: "Desafíos", desc: "Desafiá a cualquier jugador sin necesidad de torneo.", color: "text-primary", link: "/desafios" },
    { icon: <Star className="w-5 h-5" />, title: "Comunidad", desc: "Competí con jugadores de tu nivel en un ambiente recreativo.", color: "text-accent-foreground", link: null },
  ];

  // Ticker items from recent matches
  const tickerItems = recentMatches
    .filter(m => m.winner_id && m.player1_id && m.player2_id)
    .slice(0, 5)
    .map(m => {
      const winner = playersMap[m.winner_id!];
      const loser = playersMap[m.winner_id === m.player1_id ? m.player2_id! : m.player1_id!];
      const score = `${m.player1_score ?? 0}-${m.player2_score ?? 0}`;
      const ago = formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es });
      return `${winner?.full_name || "?"} venció a ${loser?.full_name || "?"} ${score} · ${ago}`;
    });

  const PlayerAvatar = ({ p, size = "w-8 h-8" }: { p: Player | undefined; size?: string }) => (
    <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden flex-shrink-0`}>
      {p?.avatar_url ? (
        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
      ) : (
        (p?.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero – 2-col grid */}
      <section className="hero-gradient border-b border-border/10 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/5 animate-float" />
          <div className="absolute bottom-10 left-10 w-32 h-32 rounded-full bg-accent/5 animate-float stagger-2" />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-28 relative grid md:grid-cols-2 gap-8 items-center">
          {/* Left – text */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Temporada 2026 activa
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-primary-foreground mb-4 leading-tight">
              TDM<br />Siete Palmas 🏓
            </h1>
            <p className="text-primary-foreground/60 text-lg mb-8 leading-relaxed max-w-lg">
              Torneos recreativos de tenis de mesa en Siete Palmas.
              Registrate, competí y subí en el ranking.
            </p>
            <div className="flex flex-wrap gap-3">
              {player ? (
                <Link
                  to={`/jugador/${player.id}`}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-heading font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 animate-pulse-glow"
                >
                  Mi Perfil <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  to="/registro"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-heading font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 animate-pulse-glow"
                >
                  Registrarme <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link
                to="/torneos"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-primary-foreground/80 font-heading font-semibold text-sm hover:text-primary-foreground transition-all border border-primary-foreground/20 hover:border-primary-foreground/40"
              >
                Ver Torneos
              </Link>
            </div>

            {/* Hero counters with count-up */}
            <div className="flex gap-6 mt-8">
              <div className="flex flex-col">
                <span className="font-heading text-2xl font-bold text-primary-foreground">{animatedPlayers}</span>
                <span className="text-xs text-primary-foreground/50">Jugadores activos</span>
              </div>
              <div className="w-px bg-primary-foreground/20" />
              <div className="flex flex-col">
                <span className="font-heading text-2xl font-bold text-primary-foreground">{animatedMatches}</span>
                <span className="text-xs text-primary-foreground/50">Partidos jugados</span>
              </div>
            </div>
          </div>

          {/* Right – paddle illustration (hidden on mobile) */}
          <div className="hidden md:flex items-center justify-center animate-slide-up stagger-2">
            <div className="w-72 h-72 lg:w-80 lg:h-80">
              <PaddleIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* Features – interactive cards */}
      <section className="container mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {features.map((f, i) => {
            const inner = (
              <div className="glass-card p-5 animate-slide-up hover:shadow-md transition-all duration-300 hover:-translate-y-1 group cursor-pointer h-full" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ${f.color} mb-3`}>
                    {f.icon}
                  </div>
                  {f.link ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  ) : (
                    <span className="text-[10px] font-medium bg-accent/15 text-accent-foreground px-2 py-0.5 rounded-full">Próximamente</span>
                  )}
                </div>
                <h3 className="font-heading font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            );
            return f.link ? (
              <Link key={i} to={f.link} className="block">{inner}</Link>
            ) : (
              <div key={i}>{inner}</div>
            );
          })}
        </div>

        {/* Activity Ticker */}
        {tickerItems.length > 0 && (
          <div className="mb-8 overflow-hidden rounded-lg bg-primary/5 py-2.5 px-4 group">
            <div className="flex gap-12 animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap">
              {[...tickerItems, ...tickerItems].map((t, i) => (
                <span key={i} className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary/40 flex-shrink-0" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Top 5 Ranking with Podium */}
        <div className="grid lg:grid-cols-3 gap-6 mb-14">
          <div className="lg:col-span-1 animate-slide-up stagger-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> Ranking
              </h2>
              <Link to="/rankings" className="text-xs text-primary hover:underline">Ver completo →</Link>
            </div>

            {loadingRanking ? (
              <div className="glass-card overflow-hidden">
                <div className="divide-y divide-border/50">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <div className="w-8 h-4 bg-muted rounded" />
                      <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
                      <div className="flex-1 h-4 bg-muted rounded w-3/4" />
                      <div className="w-10 h-4 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ) : topPlayers.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Sin jugadores aún</p>
              </div>
            ) : (
              <>
                {/* Podium – Top 3 */}
                {topPlayers.length >= 3 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[1, 0, 2].map(idx => {
                      const p = topPlayers[idx];
                      const streak = getStreak(p.id);
                      const isFirst = idx === 0;
                      return (
                        <Link
                          key={p.id}
                          to={`/jugador/${p.id}`}
                          className={`glass-card flex flex-col items-center py-4 px-2 hover:shadow-md transition-all duration-300 hover:-translate-y-1 ${isFirst ? "border-yellow-500/30 bg-yellow-500/5 -mt-3" : idx === 1 ? "" : ""}`}
                        >
                          {isFirst && <Crown className="w-5 h-5 text-yellow-500 mb-1" />}
                          <PlayerAvatar p={p} size="w-14 h-14" />
                          <span className="text-xs font-medium text-foreground mt-2 truncate w-full text-center">{p.full_name.split(" ")[0]}</span>
                          <span className="text-sm font-heading font-bold text-primary">{p.rating}</span>
                          {streak >= 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 flex items-center gap-0.5 mt-1">
                              <Flame className="w-3 h-3" /> Racha
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground mt-0.5">{idx + 1}°</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* Remaining (4th, 5th) */}
                {topPlayers.length > 3 && (
                  <div className="glass-card overflow-hidden">
                    <div className="divide-y divide-border/50">
                      {topPlayers.slice(3).map((p, i) => {
                        const streak = getStreak(p.id);
                        return (
                          <Link key={p.id} to={`/jugador/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                            <span className="w-8 text-sm font-medium text-muted-foreground">{i + 4}°</span>
                            <PlayerAvatar p={p} />
                            <span className="text-sm font-medium text-foreground flex-1 truncate flex items-center gap-1.5">
                              {p.full_name}
                              {streak >= 3 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" />
                                </span>
                              )}
                            </span>
                            <Sparkline playerId={p.id} currentRating={p.rating} />
                            <span className="text-sm font-heading font-bold text-primary">{p.rating}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Matches */}
          <div className="lg:col-span-2 animate-slide-up stagger-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> Últimos Partidos
              </h2>
            </div>
            <div className="glass-card overflow-hidden">
              {loadingMatches ? (
                <div className="divide-y divide-border/50">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 animate-pulse">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-4 bg-muted rounded w-24" />
                        <div className="h-4 bg-muted rounded w-12" />
                        <div className="h-4 bg-muted rounded w-24" />
                      </div>
                      <div className="h-3 bg-muted rounded w-16" />
                    </div>
                  ))}
                </div>
              ) : recentMatches.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Los resultados de los partidos aparecerán acá</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentMatches.slice(0, 5).map(m => {
                    const p1 = playersMap[m.player1_id || ""];
                    const p2 = playersMap[m.player2_id || ""];
                    const setScores = m.set_scores as Array<{ p1: number; p2: number }> | null;
                    const setDetail = setScores ? setScores.map(s => `${s.p1}-${s.p2}`).join(", ") : "";
                    const p1Won = m.winner_id === m.player1_id;
                    const p2Won = m.winner_id === m.player2_id;

                    return (
                      <Link key={m.id} to={`/torneo/${m.tournament_id}`} className="px-4 py-3 min-h-[44px] flex flex-col sm:flex-row sm:items-center justify-between hover:bg-muted/30 transition-colors">
                        {/* Mobile: stacked / Desktop: row */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0">
                          {/* Player 1 */}
                          <span className={`text-sm truncate flex items-center gap-1 ${p1Won ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {p1Won && <Trophy className="w-3 h-3 text-primary flex-shrink-0" />}
                            {p1?.full_name || "TBD"}
                            {p1Won && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-700 ml-1 hidden sm:inline">Ganó</span>}
                          </span>

                          {/* Score */}
                          <div className="flex items-center justify-center sm:justify-start gap-1 my-1 sm:my-0">
                            <span className={`font-heading font-bold text-sm ${p1Won ? "text-primary" : "text-muted-foreground"}`}>
                              {m.player1_score !== null ? m.player1_score : "–"}
                            </span>
                            <span className="text-muted-foreground text-xs">-</span>
                            <span className={`font-heading font-bold text-sm ${p2Won ? "text-primary" : "text-muted-foreground"}`}>
                              {m.player2_score !== null ? m.player2_score : "–"}
                            </span>
                          </div>

                          {/* Player 2 */}
                          <span className={`text-sm truncate flex items-center gap-1 ${p2Won ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {p2Won && <Trophy className="w-3 h-3 text-primary flex-shrink-0" />}
                            {p2?.full_name || "TBD"}
                            {p2Won && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-700 ml-1 hidden sm:inline">Ganó</span>}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0 sm:ml-3 flex items-center gap-2 mt-1 sm:mt-0">
                          {m.round && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m.round}</span>
                          )}
                          <div>
                            {setDetail && <span className="text-xs text-muted-foreground block">({setDetail})</span>}
                            <span className="text-xs text-muted-foreground">
                              {new Date(m.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mini Bracket – active tournament */}
        {activeTournament && bracketMatches.length > 0 && (
          <div className="mb-14 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                <Swords className="w-5 h-5 text-primary" /> Bracket: {activeTournament.name}
              </h2>
              <Link to={`/torneo/${activeTournament.id}`} className="text-xs text-primary hover:underline">Ver torneo →</Link>
            </div>
            <div className="glass-card p-4 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
              <div className="flex gap-6 min-w-max">
                {Object.entries(bracketRounds).map(([round, matches], ri) => (
                  <div key={round} className="flex flex-col gap-3 min-w-[180px]">
                    <span className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-1">{round}</span>
                    {matches.map((bm) => {
                      const bp1 = playersMap[bm.player1_id || ""];
                      const bp2 = playersMap[bm.player2_id || ""];
                      return (
                        <div key={bm.id} className="border border-border rounded-lg overflow-hidden text-sm">
                          <div className={`flex items-center justify-between px-3 py-2 ${bm.winner_id === bm.player1_id ? "bg-primary/5 font-semibold" : ""}`}>
                            <span className="truncate max-w-[110px]">{bp1?.full_name || "TBD"}</span>
                            <span className="font-heading font-bold text-xs">{bm.player1_score ?? "–"}</span>
                          </div>
                          <div className="border-t border-border" />
                          <div className={`flex items-center justify-between px-3 py-2 ${bm.winner_id === bm.player2_id ? "bg-primary/5 font-semibold" : ""}`}>
                            <span className="truncate max-w-[110px]">{bp2?.full_name || "TBD"}</span>
                            <span className="font-heading font-bold text-xs">{bm.player2_score ?? "–"}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* News Section – editorial grid */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-primary" /> Noticias
            </h2>
            <div className="flex items-center gap-4">
              <Link to="/noticias" className="text-sm text-primary hover:underline">Ver todas →</Link>
              <Link to="/reglas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
                <BookOpen className="w-4 h-4" /> Reglas
              </Link>
            </div>
          </div>

          {loadingNews ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card overflow-hidden animate-pulse">
                  <div className="h-48 bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-full" />
                    <div className="h-3 bg-muted rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : news.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Newspaper className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No hay noticias publicadas aún.</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Las noticias del club aparecerán acá.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {news.map((item, i) => {
                const isFeatured = news.length >= 3 && i === 0;
                return (
                  <Link
                    key={item.id}
                    to={`/noticia/${item.id}`}
                    className={`glass-card overflow-hidden animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group block ${isFeatured ? "md:col-span-2" : ""}`}
                    style={{ animationDelay: `${i * 0.1}s` }}
                  >
                    {item.image_url ? (
                      <div className={`${isFeatured ? "h-64" : "h-48"} overflow-hidden`}>
                        <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      </div>
                    ) : (
                      <div className={`${isFeatured ? "h-64" : "h-48"} bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center`}>
                        <span className="text-5xl opacity-30">🏓</span>
                      </div>
                    )}
                    <div className="p-5">
                      <time className="text-xs text-muted-foreground mb-2 block">
                        {new Date(item.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                      </time>
                      <h3 className={`font-heading font-semibold text-foreground mb-2 line-clamp-2 ${isFeatured ? "text-xl" : ""}`}>{item.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{stripHtml(item.content)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
