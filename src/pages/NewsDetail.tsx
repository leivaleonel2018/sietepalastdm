import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { ArrowLeft, Calendar } from "lucide-react";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export default function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const [news, setNews] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from("news").select("*").eq("id", id).single().then(({ data }) => {
      setNews(data as NewsItem | null);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Cargando...</div></div>;
  if (!news) return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Noticia no encontrada.</div></div>;

  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Inicio
        </Link>

        <article className="glass-card overflow-hidden animate-slide-up">
          {news.image_url && (
            <div className="w-full h-64 md:h-80 overflow-hidden">
              <img src={news.image_url} alt={news.title} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Calendar className="w-4 h-4" />
              {new Date(news.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-6">{news.title}</h1>
            <div className="prose prose-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {news.content}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
