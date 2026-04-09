import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { authAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Swords, Check, X } from "lucide-react";

interface Player {
  id: string;
  full_name: string;
  rating: number;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: string;
  set_scores: any;
  challenger_sets_won: number | null;
  challenged_sets_won: number | null;
  winner_id: string | null;
  rating_change_challenger: number | null;
  rating_change_challenged: number | null;
  created_at: string;
}

export default function Challenges() {
  const { player, playerToken } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [pRes, cRes] = await Promise.all([
      supabase.from("players").select("id, full_name, rating").order("full_name"),
      supabase.from("challenges").select("*").order("created_at", { ascending: false }),
    ]);
    setPlayers(pRes.data || []);
    setChallenges((cRes.data || []) as Challenge[]);
    setLoading(false);
  };

  const getPlayerName = (pid: string) => players.find(p => p.id === pid)?.full_name || "?";

  const createChallenge = async () => {
    if (!player || !selectedOpponent) return;
    const result = await authAction("create_challenge", {
      challenger_id: player.id,
      challenged_id: selectedOpponent,
      player_token: playerToken,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success("Desafío enviado");
    setSelectedOpponent("");
    fetchAll();
  };

  const respondChallenge = async (challengeId: string, accept: boolean) => {
    if (!player) return;
    const result = await authAction("respond_challenge", {
      challenge_id: challengeId,
      player_id: player.id,
      accept,
      player_token: playerToken,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success(accept ? "Desafío aceptado" : "Desafío rechazado");
    fetchAll();
  };

  const myChallenges = player ? challenges.filter(c => c.challenger_id === player.id || c.challenged_id === player.id) : [];
  const pendingForMe = player ? challenges.filter(c => c.challenged_id === player.id && c.status === "pending") : [];
  const allCompleted = challenges.filter(c => c.status === "completed");

  if (loading) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Cargando...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Swords className="w-5 h-5" /> Desafíos
        </h1>

        {/* Create Challenge */}
        {player && (
          <div className="glass-card p-5 mb-6">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Enviar Desafío</h2>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="text-xs">Oponente</Label>
                <Select value={selectedOpponent} onValueChange={setSelectedOpponent}>
                  <SelectTrigger><SelectValue placeholder="Elegí un jugador" /></SelectTrigger>
                  <SelectContent>
                    {players.filter(p => p.id !== player.id).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.rating})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createChallenge} disabled={!selectedOpponent}>Desafiar</Button>
            </div>
          </div>
        )}

        {/* Pending for me */}
        {pendingForMe.length > 0 && (
          <div className="glass-card p-5 mb-6">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Desafíos Recibidos</h2>
            <div className="space-y-2">
              {pendingForMe.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30">
                  <span className="text-sm text-foreground">{getPlayerName(c.challenger_id)} te desafió</span>
                  <div className="flex gap-1">
                    <button onClick={() => respondChallenge(c.id, true)} className="p-1.5 rounded bg-muted hover:bg-muted/80 text-foreground" title="Aceptar">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => respondChallenge(c.id, false)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Rechazar">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My active challenges */}
        {player && myChallenges.filter(c => c.status !== "completed" && c.status !== "rejected").length > 0 && (
          <div className="glass-card p-5 mb-6">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Mis Desafíos Activos</h2>
            <div className="space-y-2">
              {myChallenges.filter(c => c.status !== "completed" && c.status !== "rejected").map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 text-sm">
                  <span className="text-foreground">
                    {getPlayerName(c.challenger_id)} vs {getPlayerName(c.challenged_id)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {c.status === "pending" ? "Pendiente" : "Aceptado"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed challenges */}
        <div className="glass-card p-5">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Desafíos Completados</h2>
          {allCompleted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin desafíos completados aún.</p>
          ) : (
            <div className="space-y-1.5">
              {allCompleted.map(c => {
                const setScores = c.set_scores as Array<{p1: number; p2: number}> | null;
                const setDetail = setScores ? setScores.map(s => `${s.p1}-${s.p2}`).join(", ") : "";
                return (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 text-sm">
                    <div>
                      <span className={c.winner_id === c.challenger_id ? "font-semibold text-foreground" : "text-muted-foreground"}>
                        {getPlayerName(c.challenger_id)}
                      </span>
                      <span className="text-muted-foreground mx-2">vs</span>
                      <span className={c.winner_id === c.challenged_id ? "font-semibold text-foreground" : "text-muted-foreground"}>
                        {getPlayerName(c.challenged_id)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-heading font-bold text-foreground">
                        {c.challenger_sets_won} - {c.challenged_sets_won}
                      </span>
                      {setDetail && <span className="text-xs text-muted-foreground ml-2">({setDetail})</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
