import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Trophy } from "lucide-react";

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

  const exportPDF = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const rows = players.map((p, i) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i + 1}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${p.full_name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600">${p.rating}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html><head><title>Rankings - TDM Siete Palmas</title>
      <style>body{font-family:sans-serif;padding:40px;color:#222}
      h1{font-size:20px;margin-bottom:4px}p{color:#666;margin-bottom:20px;font-size:13px}
      table{width:100%;border-collapse:collapse}
      th{padding:8px 12px;border-bottom:2px solid #222;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.5px}
      </style></head><body>
      <h1>🏓 Rankings - TDM Siete Palmas</h1>
      <p>Generado el ${new Date().toLocaleDateString('es-AR')}</p>
      <table>
        <thead><tr><th style="text-align:center">#</th><th>Jugador</th><th style="text-align:center">Rating</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <script>setTimeout(()=>window.print(),300)</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-heading text-2xl font-bold text-foreground">Rankings</h1>
          {players.length > 0 && (
            <button onClick={exportPDF} className="text-sm px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              Exportar PDF
            </button>
          )}
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
                  <th className="text-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wide w-16">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Jugador</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wide">Rating</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, i) => (
                  <tr key={player.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="text-center px-4 py-2.5 text-sm font-medium text-muted-foreground">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link to={`/jugador/${player.id}`} className="font-medium text-foreground hover:underline">
                        {player.full_name}
                      </Link>
                    </td>
                    <td className="text-center px-4 py-2.5">
                      <span className="text-sm font-semibold text-foreground">{player.rating}</span>
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
