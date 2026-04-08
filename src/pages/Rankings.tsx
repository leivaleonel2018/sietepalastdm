import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Player {
  id: string;
  full_name: string;
  rating: number;
}

export default function Rankings() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("players")
      .select("id, full_name, rating")
      .order("rating", { ascending: false })
      .then(({ data }) => {
        setPlayers(data || []);
        setLoading(false);
      });
  }, []);

  const getMedal = (pos: number) => {
    if (pos === 0) return "🥇";
    if (pos === 1) return "🥈";
    if (pos === 2) return "🥉";
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center text-accent-foreground">
            <Trophy className="w-5 h-5" />
          </div>
          <h1 className="font-heading text-3xl font-bold text-foreground">Rankings</h1>
        </div>

        {loading ? (
          <div className="glass-card p-12 text-center text-muted-foreground">Cargando rankings...</div>
        ) : players.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">No hay jugadores registrados aún.</div>
        ) : (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-center px-4 py-3 text-sm font-semibold w-16">#</th>
                  <th className="text-left px-4 py-3 text-sm font-semibold">Jugador</th>
                  <th className="text-center px-4 py-3 text-sm font-semibold">Rating</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, i) => (
                  <tr key={player.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="text-center px-4 py-3 text-sm font-medium">
                      {getMedal(i) || i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">{player.full_name}</span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${
                        player.rating >= 800 ? "bg-secondary/20 text-secondary" :
                        player.rating >= 600 ? "bg-success/20 text-success" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {player.rating}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
