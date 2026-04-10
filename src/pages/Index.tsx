import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Users, Star, ArrowRight, Swords, BookOpen, Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export default function Index() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("news")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setNews((data || []) as NewsItem[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="hero-gradient border-b border-border/10 relative overflow-hidden">
        {/* Decorative elements */}
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
              Torneos recreativos de tenis de mesa en Ciudad de Formosa.
              Registrate, competí y subí en el ranking.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/registro"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-heading font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 animate-pulse-glow"
              >
                Registrarme <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/torneos"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-primary-foreground/80 font-heading font-semibold text-sm hover:text-primary-foreground transition-all border border-primary-foreground/20 hover:border-primary-foreground/40"
              >
                Ver Torneos
              </Link>
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

        {/* News Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-primary" /> Noticias
            </h2>
            <Link to="/reglas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors">
              <BookOpen className="w-4 h-4" /> Reglas y Puntos
            </Link>
          </div>

          {loading ? (
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
                <article
                  key={item.id}
                  className="glass-card overflow-hidden animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  {item.image_url ? (
                    <div className="h-48 overflow-hidden">
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
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
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{item.content}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
