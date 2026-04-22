import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trophy, Users, Star, ArrowRight, Swords, BookOpen, Newspaper, Crown, Medal, TrendingUp, Flame, ChevronRight, PlayCircle, Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { ScrollReveal } from "@/components/ScrollReveal";

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

interface SetScore {
  p1: number;
  p2: number;
}

interface RecentMatch {
  id: string;
  player1_id: string | null;
  player2_id: string | null;
  player1_score: number | null;
  player2_score: number | null;
  winner_id: string | null;
  set_scores: SetScore[] | null;
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

// Count-up hook — re-animates when target changes
function useCountUp(target: number | null, duration = 1200) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    if (target === null || target === prevTarget.current) return;
    prevTarget.current = target;
    const start = performance.now();
    let rafId: number;
    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
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
  const [errorNews, setErrorNews] = useState(false);
  const [errorRanking, setErrorRanking] = useState(false);
  const [errorMatches, setErrorMatches] = useState(false);
  const [totalPlayers, setTotalPlayers] = useState<number | null>(null);
  const [totalMatches, setTotalMatches] = useState<number | null>(null);
  const [activeTournament, setActiveTournament] = useState<ActiveTournament | null>(null);
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);
  const [playerStreaks, setPlayerStreaks] = useState<Record<string, number>>({});
  const [mvpPlayer, setMvpPlayer] = useState<Player | null>(null);

  // User Dashboard State
  const [userStreak, setUserStreak] = useState<number>(0);
  const [userPendingChallenges, setUserPendingChallenges] = useState<number>(0);
  const [userNextMatch, setUserNextMatch] = useState<{ id: string, round: string | null, tournament_id: string } | null>(null);

  // Parallax State
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const animatedPlayers = useCountUp(totalPlayers);
  const animatedMatches = useCountUp(totalMatches);

  const fetchData = useCallback(async () => {
    // Reset errors & stale data
    setErrorNews(false);
    setErrorRanking(false);
    setErrorMatches(false);
    setPlayersMap({});

    // Parallel fetch with individual error handling
    const [newsRes, topRes, matchesRes, playersCountRes, matchesCountRes, tournamentRes] = await Promise.all([
      supabase.from("news").select("*").order("created_at", { ascending: false }).limit(6).then(r => r, () => ({ data: null, error: true })),
      supabase.from("players").select("id, full_name, rating, avatar_url").order("rating", { ascending: false }).limit(5).then(r => r, () => ({ data: null, error: true })),
      supabase.from("matches").select("*").order("created_at", { ascending: false }).limit(10).then(r => r, () => ({ data: null, error: true })),
      supabase.from("players").select("*", { count: "exact", head: true }).then(r => r, () => ({ data: null, count: null, error: true })),
      supabase.from("matches").select("*", { count: "exact", head: true }).then(r => r, () => ({ data: null, count: null, error: true })),
      supabase.from("tournaments").select("id, name, format, status").in("status", ["in_progress", "group_stage", "knockout"]).order("created_at", { ascending: false }).limit(1).then(r => r, () => ({ data: null, error: true })),
    ]);

    // News
    if (newsRes.error) { setErrorNews(true); } else { setNews((newsRes.data || []) as NewsItem[]); }
    setLoadingNews(false);

    // Ranking & Streaks
    if (topRes.error) { 
      setErrorRanking(true); 
      setLoadingRanking(false); 
    } else { 
      const topList = (topRes.data || []) as Player[];
      setTopPlayers(topList); 
      setLoadingRanking(false);
      
      if (topList.length > 0) {
        const topIds = topList.map(p => p.id);
        const { data: streakMatches } = await supabase
          .from("matches")
          .select("player1_id, player2_id, winner_id")
          .not("winner_id", "is", null)
          .or(`player1_id.in.(${topIds.join(',')}),player2_id.in.(${topIds.join(',')})`)
          .order("created_at", { ascending: false })
          .limit(50);
          
        if (streakMatches) {
          const streakMap: Record<string, number> = {};
          topIds.forEach(id => {
            let streak = 0;
            for (const m of streakMatches) {
              if (m.player1_id !== id && m.player2_id !== id) continue;
              if (m.winner_id === id) streak++;
              else break;
            }
            streakMap[id] = streak;
          });
          setPlayerStreaks(streakMap);
        }
      }
    }

    // Matches & counts
    const recentData = (matchesRes.data || []) as RecentMatch[];
    if (matchesRes.error) { setErrorMatches(true); } else { setRecentMatches(recentData); }
    setTotalPlayers((playersCountRes as any).count ?? null);
    setTotalMatches((matchesCountRes as any).count ?? null);

    // Initial players map for recent matches BEFORE tournament bracket
    const initialPlayerIds = new Set<string>();
    recentData.forEach((m) => {
      if (m.player1_id) initialPlayerIds.add(m.player1_id);
      if (m.player2_id) initialPlayerIds.add(m.player2_id);
    });
    
    if (initialPlayerIds.size > 0) {
      const { data: pData } = await supabase.from("players").select("id, full_name, rating, avatar_url").in("id", Array.from(initialPlayerIds));
      if (pData) {
        const map: Record<string, Player> = {};
        pData.forEach((p: any) => { map[p.id] = p; });
        setPlayersMap(map);
      }
    }
    // Calculate MVP based on streaks or top recent wins
    if (topRes.data && topRes.data.length > 0) {
      // Just a simple MVP logic: the highest rated player with a streak >= 3, or the #1 player
      const mvp = (topRes.data as Player[]).find(p => playerStreaks[p.id] >= 3) || topRes.data[0];
      setMvpPlayer(mvp as Player);
    }

    setLoadingMatches(false);

    // Active tournament bracket — fetch without blocking recent matches
    const at = (tournamentRes.data || [])[0] as ActiveTournament | undefined;
    if (at && !tournamentRes.error) {
      setActiveTournament(at);
      const { data: bm } = await supabase
        .from("matches")
        .select("id, round, player1_id, player2_id, player1_score, player2_score, winner_id, match_order")
        .eq("tournament_id", at.id)
        .order("match_order", { ascending: true });
        
      const bracketData = (bm || []) as BracketMatch[];
      setBracketMatches(bracketData);
      
      const bracketPlayerIds = new Set<string>();
      bracketData.forEach((m) => {
        if (m.player1_id && !initialPlayerIds.has(m.player1_id)) bracketPlayerIds.add(m.player1_id);
        if (m.player2_id && !initialPlayerIds.has(m.player2_id)) bracketPlayerIds.add(m.player2_id);
      });
      
      if (bracketPlayerIds.size > 0) {
        const { data: bpData } = await supabase.from("players").select("id, full_name, rating, avatar_url").in("id", Array.from(bracketPlayerIds));
        if (bpData) {
          setPlayersMap(prev => {
            const newMap = { ...prev };
            bpData.forEach((p: any) => { newMap[p.id] = p; });
            return newMap;
          });
        }
      }
    } else {
      setActiveTournament(null);
      setBracketMatches([]);
    }

    // User specific dashboard data
    if (player?.id) {
      const [challengesRes, myMatchesRes, nextMatchRes] = await Promise.all([
        supabase.from("challenges").select("id", { count: "exact", head: true }).eq("challenged_id", player.id).eq("status", "pending"),
        supabase.from("matches").select("winner_id").or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`).not("winner_id", "is", null).order("created_at", { ascending: false }).limit(20),
        supabase.from("matches").select("id, round, tournament_id").or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`).is("winner_id", null).order("created_at", { ascending: true }).limit(1)
      ]);
      
      setUserPendingChallenges(challengesRes.count || 0);
      
      if (nextMatchRes.data && nextMatchRes.data.length > 0) {
        setUserNextMatch(nextMatchRes.data[0] as any);
      } else {
        setUserNextMatch(null);
      }

      let streak = 0;
      if (myMatchesRes.data) {
        for (const m of myMatchesRes.data) {
          if (m.winner_id === player.id) streak++;
          else break;
        }
      }
      setUserStreak(streak);
    }
  }, [player?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  // Generate Community Milestones / Ticker Items
  const tickerItems: React.ReactNode[] = [];
  
  if (Object.keys(playersMap).length > 0) {
    if (topPlayers.length > 0) {
      tickerItems.push(<><span className="text-yellow-500">⭐</span> @{topPlayers[0].full_name.split(' ')[0]} lidera el ranking con {topPlayers[0].rating} pts</>);
    }

    Object.entries(playerStreaks).forEach(([id, streak]) => {
      if (streak >= 2 && playersMap[id]) {
        tickerItems.push(<><span className="text-orange-500 animate-pulse">🔥</span> @{playersMap[id].full_name.split(' ')[0]} está imparable: racha de {streak} victorias</>);
      }
    });

    recentMatches
      .filter(m => m.winner_id && m.player1_id && m.player2_id && playersMap[m.player1_id] && playersMap[m.player2_id])
      .slice(0, 4)
      .forEach(m => {
        const winner = playersMap[m.winner_id!];
        const loserId = m.winner_id === m.player1_id ? m.player2_id! : m.player1_id!;
        const loser = playersMap[loserId];
        const score = `${m.player1_score ?? 0}-${m.player2_score ?? 0}`;
        tickerItems.push(<><span className="text-primary">🏓</span> @{winner.full_name.split(" ")[0]} venció a @{loser.full_name.split(" ")[0]} {score}</>);
      });
      
    if (totalPlayers && totalPlayers > 0) {
       tickerItems.push(<><span className="text-accent">🚀</span> La comunidad creció a {totalPlayers} jugadores activos</>);
    }
  }

  const PlayerAvatar = ({ p, size = "w-8 h-8" }: { p: Player | undefined; size?: string }) => {
    const name = p?.full_name || "?";
    const initials = name.split(" ").filter(Boolean).map(n => n[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
    return (
      <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden flex-shrink-0`}>
        {p?.avatar_url ? (
          <img src={p.avatar_url} alt={`Avatar de ${name}`} className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>
    );
  };
  
  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    e.currentTarget.style.setProperty('--mouse-x', x.toString());
    e.currentTarget.style.setProperty('--mouse-y', y.toString());
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Animated Nebula Background */}
      <div className="particles-bg">
        <div className="nebula-glow nebula-1"></div>
        <div className="nebula-glow nebula-2"></div>
        <div className="nebula-glow nebula-3"></div>
        <div className="dust-particles"></div>
      </div>
      
      <div className="relative z-10">
        <Navbar />

        {/* Hero – 2-col grid */}
        <section className="hero-gradient border-b border-border/10 relative overflow-hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/5 animate-float" style={{ transform: `translateY(${scrollY * 0.4}px)` }} />
          <div className="absolute bottom-10 left-10 w-32 h-32 rounded-full bg-accent/5 animate-float stagger-2" style={{ transform: `translateY(${scrollY * -0.2}px)` }} />
        </div>

        <div className="container mx-auto px-4 py-20 md:py-28 relative grid md:grid-cols-2 gap-8 items-center">
          {/* Left – text */}
          <div 
            className="animate-slide-up"
            style={{ 
              transform: `translateY(${scrollY * 0.15}px)`,
              opacity: Math.max(0, 1 - scrollY / 600)
            }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Temporada 2026 activa
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
              TDM<br />Siete Palmas 🏓
            </h1>
            <p className="text-muted-foreground text-lg mb-8 leading-relaxed max-w-lg">
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
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-foreground/80 font-heading font-semibold text-sm hover:text-foreground transition-all border border-foreground/20 hover:border-foreground/40"
              >
                Ver Torneos
              </Link>
            </div>

            {/* Hero counters with count-up */}
            <div className="flex gap-6 mt-8">
              <div className="flex flex-col">
                <span className="font-heading text-2xl font-bold text-foreground">{animatedPlayers}</span>
                <span className="text-xs text-muted-foreground">Jugadores activos</span>
              </div>
              <div className="w-px bg-foreground/20" />
              <div className="flex flex-col">
                <span className="font-heading text-2xl font-bold text-foreground">{animatedMatches}</span>
                <span className="text-xs text-muted-foreground">Partidos jugados</span>
              </div>
            </div>
          </div>

          {/* Right – paddle illustration (hidden on mobile) */}
          <div 
            className="hidden md:flex items-center justify-center animate-slide-up stagger-2"
            style={{ 
              transform: `translateY(${scrollY * 0.25}px) rotate(${scrollY * 0.05}deg)`,
              opacity: Math.max(0, 1 - scrollY / 700)
            }}
          >
            <div className="w-72 h-72 lg:w-80 lg:h-80">
              <PaddleIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* User Dashboard (Logged In) */}
      {player && (
        <ScrollReveal direction="up" delay={0.1}>
          <div className="container mx-auto px-4 -mt-8 relative z-20">
            <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 bg-card border-primary/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-heading text-lg font-bold text-foreground">Tu Estado</h3>
                  <p className="text-sm text-muted-foreground">Resumen de tu actividad reciente</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-center md:justify-end gap-6 md:gap-8 w-full md:w-auto">
                <div className="flex flex-col items-center md:items-start">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Racha Actual</span>
                  <span className="font-heading text-xl font-bold flex items-center gap-1">
                    {userStreak > 0 ? <><Flame className="w-5 h-5 text-orange-500 animate-pulse" /> {userStreak} Victorias</> : <span className="text-muted-foreground">0 Victorias</span>}
                  </span>
                </div>
                
                <div className="w-px h-10 bg-border hidden md:block"></div>
                
                <div className="flex flex-col items-center md:items-start">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Desafíos</span>
                  <Link to="/desafios" className="font-heading text-xl font-bold flex items-center gap-1 hover:text-primary transition-colors">
                    {userPendingChallenges > 0 ? (
                      <><span className="text-destructive flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive animate-pulse"></span> {userPendingChallenges}</span> Pendientes</>
                    ) : (
                      <span className="text-muted-foreground text-lg">Al día</span>
                    )}
                  </Link>
                </div>

                <div className="w-px h-10 bg-border hidden md:block"></div>

                <div className="flex flex-col items-center md:items-start">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Próximo Partido</span>
                  {userNextMatch ? (
                    <Link to={`/torneo/${userNextMatch.tournament_id}`} className="font-heading text-sm font-bold flex items-center gap-1.5 hover:bg-primary/20 transition-colors bg-primary/10 text-primary px-4 py-1.5 rounded-full border border-primary/20">
                      <Swords className="w-4 h-4" /> Torneo {userNextMatch.round ? `(${userNextMatch.round})` : ''}
                    </Link>
                  ) : (
                    <span className="font-heading text-sm font-bold text-muted-foreground flex items-center gap-1 py-1.5">
                      Ninguno programado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      )}

      {/* Features – interactive cards */}
      <section className="container mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-14">
          {features.map((f, i) => {
            const inner = (
              <ScrollReveal direction="up" delay={i * 0.1} className="h-full">
                <div className="glass-card p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-2 group cursor-pointer h-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="flex items-start justify-between relative z-10">
                    <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center ${f.color} mb-4 group-hover:scale-110 transition-transform`}>
                      {f.icon}
                    </div>
                    {f.link ? (
                      <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                    ) : (
                      <span className="text-[10px] font-bold bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-wider">Próximamente</span>
                    )}
                  </div>
                  <h3 className="font-heading font-semibold text-foreground mb-2 text-lg relative z-10">{f.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed relative z-10">{f.desc}</p>
                </div>
              </ScrollReveal>
            );
            return f.link ? (
              <Link key={i} to={f.link} className="block">{inner}</Link>
            ) : (
              <div key={i}>{inner}</div>
            );
          })}
        </div>

        {/* Achievements Ticker - eSports Style */}
        {tickerItems.length > 0 && (
          <ScrollReveal direction="up" delay={0.2}>
            <div className="mb-14 overflow-hidden rounded-xl bg-card border border-border shadow-lg flex group">
              <div className="bg-primary px-4 py-3 flex items-center justify-center relative overflow-hidden flex-shrink-0 z-10">
                <div className="absolute inset-0 bg-white/20 animate-pulse-glow" />
                <span className="font-heading font-bold text-primary-foreground text-xs uppercase tracking-widest flex items-center gap-2 relative z-10">
                  <Activity className="w-4 h-4" /> Comunidad
                </span>
              </div>
              <div className="flex-1 overflow-hidden relative flex items-center bg-card/50">
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent z-10" />
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent z-10" />
                <div className="flex gap-8 animate-marquee group-hover:[animation-play-state:paused] whitespace-nowrap px-4 py-2">
                  {[...tickerItems, ...tickerItems, ...tickerItems].map((t, i) => (
                    <span key={i} className="text-sm font-medium text-foreground inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-muted/40 border border-border/50 hover:bg-muted/80 transition-colors">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* MVP of the Week */}
        {mvpPlayer && (
          <ScrollReveal direction="up" delay={0.3}>
            <div className="mb-14 relative overflow-hidden rounded-2xl p-px bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-red-500/20 animate-pulse-glow" />
              <div className="relative bg-card rounded-[15px] p-6 flex flex-col sm:flex-row items-center gap-6 z-10">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold tracking-widest uppercase mb-3">
                    <Flame className="w-3.5 h-3.5" /> MVP de la Semana
                  </div>
                  <h3 className="font-heading text-2xl font-bold text-foreground mb-1">{mvpPlayer.full_name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">Jugador destacado por su excelente rendimiento y racha de victorias.</p>
                  <Link to={`/jugador/${mvpPlayer.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors">
                    Ver perfil <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full blur opacity-40 group-hover:opacity-75 transition duration-500"></div>
                  <div className="relative w-24 h-24 rounded-full border-4 border-card overflow-hidden">
                    {mvpPlayer.avatar_url ? (
                      <img src={mvpPlayer.avatar_url} alt="MVP" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                        {mvpPlayer.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* Top 5 Ranking with Podium */}
        <div className="grid lg:grid-cols-3 gap-6 mb-14">
          <ScrollReveal direction="left" delay={0.1} className="lg:col-span-1">
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
            ) : errorRanking ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm text-destructive mb-2">No se pudo cargar el ranking</p>
                <button onClick={fetchData} className="text-xs text-primary hover:underline">Reintentar</button>
              </div>
            ) : topPlayers.length === 0 ? (
              <div className="glass-card p-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Trophy className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Sin jugadores aún</p>
                <p className="text-xs text-muted-foreground">Regístrate para aparecer aquí</p>
              </div>
            ) : (
              <>
                {/* Podium – Top 3 */}
                {topPlayers.length >= 3 && (
                  <div className="grid grid-cols-3 gap-2 mb-3 items-end">
                    {[2, 1, 3].map((rank) => {
                      const p = topPlayers[rank - 1];
                      if (!p) return null;
                      const streak = playerStreaks[p.id] || 0;
                      const isFirst = rank === 1;
                      return (
                        <Link
                          key={p.id}
                          to={`/jugador/${p.id}`}
                          className={`glass-card hologram-card flex flex-col items-center px-2 hover:shadow-md transition-all duration-300 hover:-translate-y-1 ${isFirst ? "py-6 border-yellow-500/30 bg-yellow-500/5 shadow-md z-10" : rank === 2 ? "py-4" : "py-3"}`}
                          onMouseMove={handleMouseMove}
                        >
                          {isFirst && <Crown className="w-5 h-5 text-yellow-500 mb-1" />}
                          <PlayerAvatar p={p} size={isFirst ? "w-16 h-16" : "w-12 h-12"} />
                          <span className="text-xs font-medium text-foreground mt-2 truncate w-full text-center">{(p.full_name ?? "").split(" ")[0] || "?"}</span>
                          <span className="text-sm font-heading font-bold text-primary">{p.rating}</span>
                          {streak >= 3 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 flex items-center gap-0.5 mt-1">
                              <Flame className="w-3 h-3" /> Racha
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground mt-0.5">{rank}°</span>
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
                        const streak = playerStreaks[p.id] || 0;
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
          </ScrollReveal>

          {/* Recent Matches */}
          <ScrollReveal direction="right" delay={0.2} className="lg:col-span-2">
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
              ) : errorMatches ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-destructive mb-2">No se pudieron cargar los partidos</p>
                  <button onClick={fetchData} className="text-xs text-primary hover:underline">Reintentar</button>
                </div>
              ) : recentMatches.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Swords className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Sin partidos recientes</p>
                  <p className="text-xs text-muted-foreground">Los resultados aparecerán aquí</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {recentMatches.slice(0, 5).map(m => {
                    const p1 = playersMap[m.player1_id || ""];
                    const p2 = playersMap[m.player2_id || ""];
                    const setScores = m.set_scores;
                    const setDetail = Array.isArray(setScores) ? setScores.map(s => `${s?.p1 ?? 0}-${s?.p2 ?? 0}`).join(", ") : "";
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
          </ScrollReveal>
        </div>

        {/* Mini Bracket – active tournament */}
        {activeTournament && bracketMatches.length > 0 && (
          <ScrollReveal direction="up" delay={0.1}>
            <div className="mb-14">
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
          </ScrollReveal>
        )}

        {/* News Section – editorial grid */}
        <ScrollReveal direction="up" delay={0.2}>
          <div className="mb-8">
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
          ) : errorNews ? (
            <div className="glass-card p-12 text-center">
              <Newspaper className="w-10 h-10 text-destructive/40 mx-auto mb-3" />
              <p className="text-sm text-destructive mb-2">No se pudieron cargar las noticias</p>
              <button onClick={fetchData} className="text-xs text-primary hover:underline">Reintentar</button>
            </div>
          ) : news.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Newspaper className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No hay noticias publicadas aún.</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Las noticias del club aparecerán acá.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Featured News */}
              {news.length > 0 && (
                <Link
                  to={`/noticia/${news[0].id}`}
                  className="glass-card lg:col-span-8 min-h-[400px] md:min-h-[450px] group relative overflow-hidden flex flex-col justify-end p-6 md:p-10"
                >
                  <div className="absolute inset-0">
                    {news[0].image_url ? (
                      <img src={news[0].image_url} alt={news[0].title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                        <span className="text-8xl opacity-20">🏓</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent"></div>
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500"></div>
                  </div>
                  <div className="relative z-10 animate-slide-up">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase tracking-widest mb-4 backdrop-blur-md border border-primary/20">
                      Destacado
                    </div>
                    <h3 className="font-heading font-bold text-3xl md:text-4xl text-white mb-3 leading-tight group-hover:text-primary transition-colors drop-shadow-lg">{news[0].title}</h3>
                    <p className="text-gray-300 line-clamp-2 md:line-clamp-3 text-sm md:text-base max-w-2xl drop-shadow-md">{stripHtml(news[0].content)}</p>
                    <div className="mt-5 flex items-center gap-2 text-primary text-sm font-semibold uppercase tracking-wider">
                      Leer artículo <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              )}

              {/* Secondary News */}
              {news.length > 1 && (
                <div className="lg:col-span-4 flex flex-col gap-4">
                  {news.slice(1, 4).map((item) => (
                    <Link
                      key={item.id}
                      to={`/noticia/${item.id}`}
                      className="glass-card flex-1 flex flex-col group hover:-translate-y-1 transition-all duration-300 overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      <div className="p-5 flex flex-col h-full relative z-10 justify-center">
                        <time className="text-[10px] uppercase tracking-widest font-bold text-primary mb-2 block">
                          {new Date(item.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}
                        </time>
                        <h3 className="font-heading font-semibold text-lg text-foreground leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">{item.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-auto">{stripHtml(item.content)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </ScrollReveal>
      </section>
      </div>
    </div>
  );
}
