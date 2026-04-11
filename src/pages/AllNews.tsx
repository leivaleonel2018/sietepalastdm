import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Newspaper, ArrowLeft } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export default function AllNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("news").select("*").order("created_at", { ascending: false }).then(({ data }) => {
      setNews((data || []) as NewsItem[]);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Inicio
        </Link>
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Newspaper className="w-6 h-6 text-primary" /> Todas las Noticias
        </h1>

        {loading ? (
          <p className="text-muted-foreground">Cargando...</p>
        ) : news.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">No hay noticias publicadas.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {news.map((item, i) => (
              <Link
                key={item.id}
                to={`/noticia/${item.id}`}
                className="glass-card overflow-hidden animate-slide-up hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group block"
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                {item.image_url ? (
                  <div className="h-48 overflow-hidden">
                    <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
