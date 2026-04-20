import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Trophy, Medal, Crown } from "lucide-react";
import AnimatedList from "@/components/AnimatedList";

interface Player {
  id: string;
  full_name: string;
  rating: number;
  avatar_url: string | null;
}

const PlayerAvatar = ({ player, size = "w-8 h-8" }: { player: Player; size?: string }) => (
  <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden flex-shrink-0`}>
    {player.avatar_url ? (
      <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
    ) : (
      player.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    )}
  </div>
);

export default function Rankings() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("players")
      .select("id, full_name, rating, avatar_url")
      .order("rating", { ascending: false })
      .then(({ data }) => {
        setPlayers(data || []);
        setLoading(false);
      });
  }, []);

  const getRankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (i === 1) return <Medal className="w-4 h-4 text-gray-400" />;
    if (i === 2) return <Medal className="w-4 h-4 text-amber-600" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6 animate-slide-up">
          <h1 className="font-heading text-2xl font-bold text-foreground flex items-center gap-2">
            <Trophy className="w-6 h-6 text-primary" /> Rankings
          </h1>
          {players.length > 0 && (
            <button
              onClick={() => {
                const pw = window.open('', '_blank');
                if (!pw) return;
                const rows = players.map((p, i) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i+1}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${p.full_name}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600">${p.rating}</td></tr>`).join('');
                pw.document.write(`<html><head><title>Rankings</title><style>body{font-family:sans-serif;padding:40px}table{width:100%;border-collapse:collapse}th{padding:8px 12px;border-bottom:2px solid #222;text-align:left;font-size:12px;text-transform:uppercase}</style></head><body><h1>🏓 Rankings TDM</h1><p>Generado: ${new Date().toLocaleDateString('es-AR')}</p><table><thead><tr><th style="text-align:center">#</th><th>Jugador</th><th style="text-align:center">Rating</th></tr></thead><tbody>${rows}</tbody></table><script>setTimeout(()=>window.print(),300)</script></body></html>`);
                pw.document.close();
              }}
              className="text-sm px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              Exportar PDF
            </button>
          )}
        </div>

        {/* Top 3 podium */}
        {players.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 mb-6 animate-slide-up stagger-1">
            {[1, 0, 2].map(idx => {
              const p = players[idx];
              const isFirst = idx === 0;
              return (
                <Link key={p.id} to={`/jugador/${p.id}`} className={`glass-card p-4 text-center hover:shadow-md transition-all ${isFirst ? "ring-2 ring-primary/30 -mt-2" : ""}`}>
                  <div className="text-3xl mb-1">{idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}</div>
                  <div className="flex justify-center mb-2">
                    <PlayerAvatar player={p} size="w-12 h-12" />
                  </div>
                  <h3 className="font-heading font-semibold text-sm text-foreground truncate">{p.full_name}</h3>
                  <p className="font-heading font-bold text-xl text-primary">{p.rating}</p>
                </Link>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="glass-card p-12 text-center text-muted-foreground">Cargando rankings...</div>
        ) : players.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">No hay jugadores registrados.</div>
        ) : (
          <div className="glass-card overflow-hidden animate-slide-up stagger-2 p-4">
            <div className="flex bg-muted/50 px-4 py-2.5 mb-2 text-xs font-semibold uppercase tracking-wide rounded-lg">
              <div className="w-12 text-center">#</div>
              <div className="flex-1 px-4 text-left">Jugador</div>
              <div className="w-24 text-right pr-4">Rating</div>
            </div>
            <AnimatedList
              items={players}
              className="w-full"
              showGradients={true}
              renderItem={(player, i, isSelected) => (
                <div className={`flex items-center p-3 rounded-xl border transition-all ${isSelected ? 'bg-muted/80 border-primary/30 shadow-sm scale-[1.02]' : 'bg-card border-border/40 hover:border-border/80'}`}>
                  <div className="w-12 flex justify-center text-sm font-bold text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      {getRankIcon(i)}
                      <span>#{i + 1}</span>
                    </div>
                  </div>
                  <div className="flex-1 px-4">
                    <Link to={`/jugador/${player.id}`} className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-3 w-fit">
                      <PlayerAvatar player={player} size="w-10 h-10" />
                      {player.full_name}
                    </Link>
                  </div>
                  <div className="w-24 text-right pr-2">
                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold inline-block shadow-sm">
                      {player.rating}
                    </div>
                  </div>
                </div>
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
