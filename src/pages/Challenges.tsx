import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { authAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Swords, Check, X, Trophy, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Player {
  id: string;
  full_name: string;
  rating: number;
  avatar_url: string | null;
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

interface SetScore { p1: string; p2: string }

// IDs of players allowed to register any challenge result
const RESULT_REGISTRARS: string[] = [];
// We'll populate by name match after fetching players

const REGISTRAR_NAMES = [
  "Hernán Ariel Duarte",
  "Leonel Samuel Leiva",
  "Gonzalez Octavio",
];

const PlayerAvatar = ({ player, size = "w-8 h-8" }: { player: Player | undefined; size?: string }) => (
  <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary overflow-hidden flex-shrink-0`}>
    {player?.avatar_url ? (
      <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
    ) : (
      (player?.full_name || "?").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    )}
  </div>
);

export default function Challenges() {
  const { player, playerToken } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, Player>>({});
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrarIds, setRegistrarIds] = useState<Set<string>>(new Set());

  // Result recording form
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [sets, setSets] = useState<SetScore[]>([{ p1: "", p2: "" }, { p1: "", p2: "" }]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [pRes, cRes] = await Promise.all([
      supabase.from("players").select("id, full_name, rating, avatar_url").order("full_name"),
      supabase.from("challenges").select("*").order("created_at", { ascending: false }),
    ]);
    const allPlayers = (pRes.data || []) as Player[];
    setPlayers(allPlayers);

    const pMap: Record<string, Player> = {};
    allPlayers.forEach(p => { pMap[p.id] = p; });
    setPlayersMap(pMap);

    // Find registrar IDs by name (case-insensitive)
    const rIds = new Set<string>();
    allPlayers.forEach(p => {
      if (REGISTRAR_NAMES.some(n => n.toLowerCase() === p.full_name.toLowerCase())) {
        rIds.add(p.id);
      }
    });
    setRegistrarIds(rIds);

    setChallenges((cRes.data || []) as Challenge[]);
    setLoading(false);
  };

  const getPlayer = (pid: string) => playersMap[pid];
  const getPlayerName = (pid: string) => playersMap[pid]?.full_name || "?";

  const canRecordResult = (c: Challenge): boolean => {
    if (!player) return false;
    // Participant can record
    if (c.challenger_id === player.id || c.challenged_id === player.id) return true;
    // Registrars can record any
    if (registrarIds.has(player.id)) return true;
    return false;
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

  const submitResult = async (challengeId: string) => {
    if (!player) return;
    const validSets = sets.filter(s => s.p1 !== "" && s.p2 !== "");
    if (validSets.length < 2) {
      toast.error("Registrá al menos 2 sets");
      return;
    }
    const set_scores = validSets.map(s => ({ p1: parseInt(s.p1), p2: parseInt(s.p2) }));

    let p1Wins = 0, p2Wins = 0;
    set_scores.forEach(s => { if (s.p1 > s.p2) p1Wins++; else p2Wins++; });
    if (p1Wins < 2 && p2Wins < 2) {
      toast.error("Alguien debe ganar al menos 2 sets (mejor de 3)");
      return;
    }

    const result = await authAction("record_challenge_result", {
      challenge_id: challengeId,
      set_scores,
      player_id: player.id,
      player_token: playerToken,
    });
    if (result.error) { toast.error(result.error); return; }
    toast.success("Resultado registrado. Ratings actualizados.");
    setRecordingId(null);
    setSets([{ p1: "", p2: "" }, { p1: "", p2: "" }]);
    fetchAll();
  };

  const pendingForMe = player ? challenges.filter(c => c.challenged_id === player.id && c.status === "pending") : [];
  const acceptedMine = player
    ? challenges.filter(c =>
        c.status === "accepted" &&
        (c.challenger_id === player.id || c.challenged_id === player.id || registrarIds.has(player.id))
      )
    : [];
  const pendingSent = player ? challenges.filter(c => c.challenger_id === player.id && c.status === "pending") : [];
  const allCompleted = challenges.filter(c => c.status === "completed");

  if (loading) {
    return <div className="min-h-screen bg-background"><Navbar /><div className="container mx-auto px-4 py-16 text-center text-muted-foreground">Cargando...</div></div>;
  }

  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-2 flex items-center gap-2 animate-slide-up">
          <Swords className="w-6 h-6 text-primary" /> Desafíos
        </h1>
        <p className="text-muted-foreground text-sm mb-6 animate-slide-up stagger-1">
          Desafiá a cualquier jugador desde su perfil. Se juegan al mejor de 3 sets.
        </p>

        {/* Pending for me */}
        {pendingForMe.length > 0 && (
          <div className="glass-card p-5 mb-4 animate-slide-up stagger-1 border-l-4 border-l-primary">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">⚡ Desafíos Recibidos</h2>
            <div className="space-y-2">
              {pendingForMe.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar player={getPlayer(c.challenger_id)} size="w-7 h-7" />
                    <span className="text-sm text-foreground">
                      <Link to={`/jugador/${c.challenger_id}`} className="font-medium hover:underline">{getPlayerName(c.challenger_id)}</Link> te desafió
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => respondChallenge(c.id, true)} className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary" title="Aceptar">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => respondChallenge(c.id, false)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Rechazar">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accepted - record result */}
        {acceptedMine.length > 0 && (
          <div className="glass-card p-5 mb-4 animate-slide-up stagger-2 border-l-4 border-l-accent">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">🏓 Partidos por jugar</h2>
            <div className="space-y-3">
              {acceptedMine.map(c => {
                const isRecording = recordingId === c.id;
                const challenger = getPlayer(c.challenger_id);
                const challenged = getPlayer(c.challenged_id);
                return (
                  <div key={c.id} className="p-3 rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <PlayerAvatar player={challenger} size="w-7 h-7" />
                        <span className="text-sm text-foreground">
                          <Link to={`/jugador/${c.challenger_id}`} className="font-medium hover:underline">{getPlayerName(c.challenger_id)}</Link>
                          <span className="text-muted-foreground mx-1.5">vs</span>
                          <Link to={`/jugador/${c.challenged_id}`} className="font-medium hover:underline">{getPlayerName(c.challenged_id)}</Link>
                        </span>
                        <PlayerAvatar player={challenged} size="w-7 h-7" />
                      </div>
                      {!isRecording && canRecordResult(c) && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setRecordingId(c.id);
                          setSets([{ p1: "", p2: "" }, { p1: "", p2: "" }]);
                        }}>
                          Registrar resultado
                        </Button>
                      )}
                    </div>

                    {isRecording && (
                      <div className="mt-3 space-y-2 p-3 rounded-lg bg-card border border-border">
                        <p className="text-xs text-muted-foreground">
                          J1: {getPlayerName(c.challenger_id)} — J2: {getPlayerName(c.challenged_id)} · Mejor de 3
                        </p>
                        {sets.map((set, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-8">Set {i + 1}</span>
                            <Input
                              type="number" placeholder="J1" value={set.p1} min="0"
                              onChange={e => { const n = [...sets]; n[i] = { ...n[i], p1: e.target.value }; setSets(n); }}
                              className="w-20 h-8 text-sm"
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                              type="number" placeholder="J2" value={set.p2} min="0"
                              onChange={e => { const n = [...sets]; n[i] = { ...n[i], p2: e.target.value }; setSets(n); }}
                              className="w-20 h-8 text-sm"
                            />
                            {sets.length > 2 && (
                              <button type="button" onClick={() => setSets(sets.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                            )}
                          </div>
                        ))}
                        {sets.length < 3 && (
                          <button type="button" onClick={() => setSets([...sets, { p1: "", p2: "" }])} className="text-xs text-primary hover:underline">
                            + Set 3
                          </button>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" onClick={() => submitResult(c.id)}>Confirmar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setRecordingId(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pending sent */}
        {pendingSent.length > 0 && (
          <div className="glass-card p-5 mb-4 animate-slide-up stagger-2">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Desafíos Enviados</h2>
            <div className="space-y-2">
              {pendingSent.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                  <div className="flex items-center gap-2">
                    <PlayerAvatar player={getPlayer(c.challenged_id)} size="w-7 h-7" />
                    <span className="text-foreground">
                      Desafiaste a <Link to={`/jugador/${c.challenged_id}`} className="font-medium hover:underline">{getPlayerName(c.challenged_id)}</Link>
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">Pendiente</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        <div className="glass-card p-5 animate-slide-up stagger-3">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Desafíos Completados
          </h2>
          {allCompleted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin desafíos completados aún.</p>
          ) : (
            <div className="space-y-2">
              {allCompleted.map(c => {
                const setScores = c.set_scores as Array<{p1: number; p2: number}> | null;
                const setDetail = setScores ? setScores.map(s => `${s.p1}-${s.p2}`).join(", ") : "";
                const challenger = getPlayer(c.challenger_id);
                const challenged = getPlayer(c.challenged_id);
                const challengerWon = c.winner_id === c.challenger_id;
                const challengedWon = c.winner_id === c.challenged_id;
                const ago = formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: es });

                return (
                  <div key={c.id} className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <PlayerAvatar player={challenger} size="w-7 h-7" />
                        <Link to={`/jugador/${c.challenger_id}`} className={`text-sm hover:underline truncate ${challengerWon ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {getPlayerName(c.challenger_id)}
                        </Link>
                        {challengerWon && <Trophy className="w-3 h-3 text-primary flex-shrink-0" />}

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <span className={`font-heading font-bold text-sm ${challengerWon ? "text-primary" : "text-muted-foreground"}`}>{c.challenger_sets_won}</span>
                          <span className="text-muted-foreground text-xs">-</span>
                          <span className={`font-heading font-bold text-sm ${challengedWon ? "text-primary" : "text-muted-foreground"}`}>{c.challenged_sets_won}</span>
                        </div>

                        {challengedWon && <Trophy className="w-3 h-3 text-primary flex-shrink-0" />}
                        <Link to={`/jugador/${c.challenged_id}`} className={`text-sm hover:underline truncate ${challengedWon ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {getPlayerName(c.challenged_id)}
                        </Link>
                        <PlayerAvatar player={challenged} size="w-7 h-7" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-2">
                        {setDetail && <span className="text-xs text-muted-foreground">Sets: {setDetail}</span>}
                        {c.rating_change_challenger != null && c.rating_change_challenger !== 0 && (
                          <span className={`text-[10px] flex items-center gap-0.5 ${c.rating_change_challenger > 0 ? "text-green-600" : "text-red-500"}`}>
                            {c.rating_change_challenger > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {c.rating_change_challenger > 0 ? "+" : ""}{c.rating_change_challenger}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" /> {ago}
                      </span>
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
