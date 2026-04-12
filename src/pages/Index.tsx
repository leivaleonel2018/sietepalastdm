import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Users, Star, ArrowRight, Swords, BookOpen, Newspaper, Crown, Medal, TrendingUp } from "lucide-react";
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

const stripHtml = (str: string) => str.replace(/<[^>]*>/g, "").trim();

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

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [newsRes, topRes, matchesRes, playersCountRes, matchesCountRes] = await Promise.all([
          supabase.from("news").select("*").order("created_at", { ascending: false }).limit(6),
          supabase.from("players").select("id, full_name, rating, avatar_url").order("rating", { ascending: false }).limit(5),
          supabase.from("matches").select("*").order("created_at", { ascending: false }).limit(5),
          supabase.from("players").select("*", { count: "exact", head: true }),
          supabase.from("matches").select("*", { count: "exact", head: true }),
        ]);

        setNews((newsRes.data || []) as NewsItem[]);
        setLoadingNews(false);

        setTopPlayers((topRes.data || []) as Player[]);
        setLoadingRanking(false);

        setRecentMatches((matchesRes.data || []) as RecentMatch[]);
        setTotalPlayers(playersCountRes.count ?? null);
        setTotalMatches(matchesCountRes.count ?? null);

        // Build players map for matches
        const playerIds = new Set<string>();
        (matchesRes.data || []).forEach((m: any) => {
          if (m.player1_id) playerIds.add(m.player1_id);
          if (m.player2_id) playerIds.add(m.player2_id);
        });
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

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (i === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (i === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="hero-gradient border-b border-border/10 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/5 animate-float" />
          <div className="absolute bottom-10 left-10 w-32 h-32 rounded-full bg-accent/5 animate-float stagger-2" />
          <div className="absolute top-1/2 right-1/4 text-8xl opacity-[0.04] animate-spin-slow">🏓</div>
        </div>

        <div className="container mx-auto px-4 py-20 md:py-28 relative">
          <div className="max-w-2xl animate-slide-up">
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

            {/* Hero counters */}
            <div className="flex gap-6 mt-8">
              <div className="flex flex-col">
                <span className="font-heading text-2xl font-bold text-primary-foreground">{totalPlayers ?? "–"}</span>
                <span className="text-xs text-primary-foreground/50">Jugadores activos</span>
              </div>
              <div className="w-px bg-primary-foreground/20" />
              <div className="flex flex-col">
                <span className="font-heading text-2xl font-bold text-primary-foreground">{totalMatches ?? "–"}</span>
                <span className="text-xs text-primary-foreground/50">Partidos jugados</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-14">
        <div className="grid md:grid-cols-4 gap-4 mb-14">
          {[
            { icon: <Trophy className="w-5 h-5" />, title: "Torneos", desc: "Fase de grupos, eliminación directa, individuales y dobles.", color: "text-primary" },
            { icon: <Users className="w-5 h-5" />, title: "Rankings", desc: "Sistema de rating basado en rendimiento partido a partido.", color: "text-primary" },
            { icon: <Swords className="w-5 h-5" />, title: "Desafíos", desc: "Desafiá a cualquier jugador sin necesidad de torneo.", color: "text-primary" },
            { icon: <Star className="w-5 h-5" />, title: "Comunidad", desc: "Competí con jugadores de tu nivel en un ambiente recreativo.", color: "text-accent-foreground" },
          ].map((f, i) => (
            <div key={i} className="glass-card p-5 animate-slide-up hover:shadow-md transition-all duration-300 hover:-translate-y-1" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className={`w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center ${f.color} mb-3`}>
                {f.icon}
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Top 5 Ranking */}
        <div className="grid lg:grid-cols-3 gap-6 mb-14">
          <div className="lg:col-span-1 animate-slide-up stagger-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" /> Ranking
              </h2>
              <Link to="/rankings" className="text-xs text-primary hover:underline">Ver completo →</Link>
            </div>
            <div className="glass-card overflow-hidden">
              {loadingRanking ? (
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
              ) : topPlayers.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground text-center">Sin jugadores aún</p>
              ) : (
                <div className="divide-y divide-border/50">
                  {topPlayers.map((p, i) => (
                    <Link key={p.id} to={`/jugador/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-1 w-8 text-sm font-medium text-muted-foreground">
                        {getRankIcon(i)}
                        {i + 1}°
                      </div>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden flex-shrink-0">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          p.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground flex-1 truncate">{p.full_name}</span>
                      <span className="text-sm font-heading font-bold text-primary">{p.rating}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
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
                  {recentMatches.map(m => {
                    const p1 = playersMap[m.player1_id || ""];
                    const p2 = playersMap[m.player2_id || ""];
                    const setScores = m.set_scores as Array<{p1: number; p2: number}> | null;
                    const setDetail = setScores ? setScores.map(s => `${s.p1}-${s.p2}`).join(", ") : "";

                    return (
                      <Link key={m.id} to={`/torneo/${m.tournament_id}`} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors block">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className={`text-sm truncate ${m.winner_id === m.player1_id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {p1?.full_name || "TBD"}
                          </span>
                          <span className="font-heading font-bold text-foreground text-sm px-2">
                            {m.player1_score !== null ? m.player1_score : "–"} - {m.player2_score !== null ? m.player2_score : "–"}
                          </span>
                          <span className={`text-sm truncate ${m.winner_id === m.player2_id ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                            {p2?.full_name || "TBD"}
                          </span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3 flex items-center gap-2">
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

        {/* News Section */}
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
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {news.map((item, i) => (
                <Link
                  key={item.id}
                  to={`/noticia/${item.id}`}
                  className="glass-card overflow-hidden animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group block"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {item.image_url ? (
                    <div className="h-48 overflow-hidden">
                      <img src={item.image_url} alt={item.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                      <span className="text-5xl opacity-30">🏓</span>
                    </div>
                  )}
                  <div className="p-5">
                    <time className="text-xs text-muted-foreground mb-2 block">
                      {new Date(item.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
                    </time>
                    <h3 className="font-heading font-semibold text-foreground mb-2 line-clamp-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{stripHtml(item.content)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
