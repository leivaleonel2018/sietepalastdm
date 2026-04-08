import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Play, CheckCircle, Award, Zap } from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  format: string;
  type: string;
  status: string;
  max_players: number | null;
  groups_count: number | null;
  created_at: string;
}

interface Player {
  id: string;
  full_name: string;
  rating: number;
}

export default function AdminPanel() {
  const { isAdmin, adminToken } = useAuth();
  const navigate = useNavigate();

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, string[]>>({});

  const [newTournament, setNewTournament] = useState({
    name: "", description: "", format: "single_elimination", type: "singles",
    max_players: "", groups_count: "4"
  });

  const [matchForm, setMatchForm] = useState({
    tournament_id: "", player1_id: "", player2_id: "",
    player1_score: "", player2_score: "", round: "", group_name: ""
  });

  const [placementForm, setPlacementForm] = useState({ player_id: "", placement: "" });

  useEffect(() => {
    if (!isAdmin) { navigate("/login"); return; }
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    const [t, p, r] = await Promise.all([
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
      supabase.from("players").select("id, full_name, rating").order("full_name"),
      supabase.from("tournament_registrations").select("tournament_id, player_id"),
    ]);
    setTournaments(t.data || []);
    setPlayers(p.data || []);
    const regsMap: Record<string, string[]> = {};
    (r.data || []).forEach(reg => {
      if (!regsMap[reg.tournament_id]) regsMap[reg.tournament_id] = [];
      regsMap[reg.tournament_id].push(reg.player_id);
    });
    setRegistrations(regsMap);
  };

  const createTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const data = await adminAction("create_tournament", {
      name: newTournament.name,
      description: newTournament.description || null,
      format: newTournament.format,
      type: newTournament.type,
      max_players: newTournament.max_players ? parseInt(newTournament.max_players) : null,
      groups_count: parseInt(newTournament.groups_count),
    }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Torneo creado");
    setNewTournament({ name: "", description: "", format: "single_elimination", type: "singles", max_players: "", groups_count: "4" });
    fetchAll();
  };

  const updateStatus = async (id: string, status: string) => {
    if (!adminToken) return;
    await adminAction("update_tournament_status", { tournament_id: id, status }, adminToken);
    toast.success("Estado actualizado");
    fetchAll();
  };

  const deleteTournament = async (id: string) => {
    if (!adminToken || !confirm("¿Eliminar este torneo?")) return;
    await adminAction("delete_tournament", { tournament_id: id }, adminToken);
    toast.success("Torneo eliminado");
    fetchAll();
  };

  const generateBracket = async (tournamentId: string) => {
    if (!adminToken) return;
    const data = await adminAction("generate_bracket", { tournament_id: tournamentId }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success(`Bracket generado: ${data.matches_created} partidos creados`);
    fetchAll();
  };

  const recordMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    if (matchForm.player1_id === matchForm.player2_id) {
      toast.error("Los jugadores deben ser diferentes");
      return;
    }
    const data = await adminAction("record_match", {
      tournament_id: matchForm.tournament_id,
      player1_id: matchForm.player1_id,
      player2_id: matchForm.player2_id,
      player1_score: parseInt(matchForm.player1_score),
      player2_score: parseInt(matchForm.player2_score),
      round: matchForm.round || null,
      group_name: matchForm.group_name || null,
    }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Partido registrado. Ratings actualizados.");
    setMatchForm({ tournament_id: matchForm.tournament_id, player1_id: "", player2_id: "", player1_score: "", player2_score: "", round: "", group_name: "" });
    fetchAll();
  };

  const addPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const data = await adminAction("add_placement_points", {
      player_id: placementForm.player_id,
      placement: placementForm.placement,
    }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success(`Puntos aplicados: ${data.points > 0 ? "+" : ""}${data.points}`);
    setPlacementForm({ player_id: "", placement: "" });
    fetchAll();
  };

  const registerPlayerToTournament = async (tournamentId: string, playerId: string) => {
    if (!adminToken) return;
    const data = await adminAction("register_player_tournament", {
      tournament_id: tournamentId,
      player_id: playerId,
    }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Jugador inscripto");
    fetchAll();
  };

  if (!isAdmin) return null;

  const tournamentPlayers = matchForm.tournament_id
    ? players.filter(p => (registrations[matchForm.tournament_id] || []).includes(p.id))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Panel de Admin</h1>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Create Tournament */}
          <div className="glass-card p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Crear Torneo
            </h2>
            <form onSubmit={createTournament} className="space-y-2.5">
              <div>
                <Label className="text-xs">Nombre</Label>
                <Input value={newTournament.name} onChange={e => setNewTournament(p => ({...p, name: e.target.value}))} required maxLength={100} />
              </div>
              <div>
                <Label className="text-xs">Descripción (opcional)</Label>
                <Input value={newTournament.description} onChange={e => setNewTournament(p => ({...p, description: e.target.value}))} maxLength={255} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Formato</Label>
                  <Select value={newTournament.format} onValueChange={v => setNewTournament(p => ({...p, format: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_elimination">Eliminación Directa</SelectItem>
                      <SelectItem value="groups">Fase de Grupos</SelectItem>
                      <SelectItem value="groups_then_elimination">Grupos + Eliminación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={newTournament.type} onValueChange={v => setNewTournament(p => ({...p, type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singles">Individual</SelectItem>
                      <SelectItem value="doubles">Dobles (2v2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Máx. jugadores</Label>
                  <Input type="number" value={newTournament.max_players} onChange={e => setNewTournament(p => ({...p, max_players: e.target.value}))} />
                </div>
                {(newTournament.format === "groups" || newTournament.format === "groups_then_elimination") && (
                  <div>
                    <Label className="text-xs">Grupos</Label>
                    <Input type="number" value={newTournament.groups_count} onChange={e => setNewTournament(p => ({...p, groups_count: e.target.value}))} min="2" />
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full">Crear Torneo</Button>
            </form>
          </div>

          {/* Record Match */}
          <div className="glass-card p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Registrar Partido</h2>
            <form onSubmit={recordMatch} className="space-y-2.5">
              <div>
                <Label className="text-xs">Torneo</Label>
                <Select value={matchForm.tournament_id} onValueChange={v => setMatchForm(p => ({...p, tournament_id: v, player1_id: "", player2_id: ""}))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {tournaments.filter(t => t.status !== "finished").map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Jugador 1</Label>
                  <Select value={matchForm.player1_id} onValueChange={v => setMatchForm(p => ({...p, player1_id: v}))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {tournamentPlayers.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.rating})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Jugador 2</Label>
                  <Select value={matchForm.player2_id} onValueChange={v => setMatchForm(p => ({...p, player2_id: v}))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {tournamentPlayers.filter(p => p.id !== matchForm.player1_id).map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.rating})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Sets J1</Label>
                  <Input type="number" value={matchForm.player1_score} onChange={e => setMatchForm(p => ({...p, player1_score: e.target.value}))} required min="0" />
                </div>
                <div>
                  <Label className="text-xs">Sets J2</Label>
                  <Input type="number" value={matchForm.player2_score} onChange={e => setMatchForm(p => ({...p, player2_score: e.target.value}))} required min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Ronda</Label>
                  <Input value={matchForm.round} onChange={e => setMatchForm(p => ({...p, round: e.target.value}))} placeholder="ej: Cuartos" />
                </div>
                <div>
                  <Label className="text-xs">Grupo</Label>
                  <Input value={matchForm.group_name} onChange={e => setMatchForm(p => ({...p, group_name: e.target.value}))} placeholder="ej: Grupo A" />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={!matchForm.player1_id || !matchForm.player2_id}>
                Registrar Partido
              </Button>
            </form>
          </div>

          {/* Placement Points */}
          <div className="glass-card p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
              <Award className="w-4 h-4" /> Puntos por Instancia
            </h2>
            <form onSubmit={addPlacement} className="space-y-2.5">
              <div>
                <Label className="text-xs">Jugador</Label>
                <Select value={placementForm.player_id} onValueChange={v => setPlacementForm(p => ({...p, player_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {players.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.rating})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Instancia</Label>
                <Select value={placementForm.placement} onValueChange={v => setPlacementForm(p => ({...p, placement: v}))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campeon">Campeón (+30)</SelectItem>
                    <SelectItem value="subcampeon">Sub-Campeón (+25)</SelectItem>
                    <SelectItem value="tercero">Tercero (+21)</SelectItem>
                    <SelectItem value="4to">4° de final (+17)</SelectItem>
                    <SelectItem value="8vo">8° de final (+13)</SelectItem>
                    <SelectItem value="16vo">16° de final (+10)</SelectItem>
                    <SelectItem value="32vo">32° de final (+8)</SelectItem>
                    <SelectItem value="64vo">64° de final (+6)</SelectItem>
                    <SelectItem value="128vo">128° de final (+4)</SelectItem>
                    <SelectItem value="grupo_perdido">Perdido en grupo (-2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" variant="outline" disabled={!placementForm.player_id || !placementForm.placement}>
                Aplicar Puntos
              </Button>
            </form>
          </div>

          {/* Manage Tournaments */}
          <div className="glass-card p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Gestionar Torneos</h2>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {tournaments.map(t => {
                const regs = registrations[t.id] || [];
                return (
                  <div key={t.id} className="p-3 rounded-md bg-muted/30 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-xs text-foreground">{t.name}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">
                        {t.status === "registration" ? "Inscripción" : t.status === "in_progress" ? "En Curso" : "Fin"} · {regs.length} jugadores
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {t.status === "registration" && t.format === "single_elimination" && regs.length >= 2 && (
                        <button onClick={() => generateBracket(t.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Generar bracket">
                          <Zap className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {t.status === "registration" && (
                        <button onClick={() => updateStatus(t.id, "in_progress")} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Iniciar">
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {t.status === "in_progress" && (
                        <button onClick={() => updateStatus(t.id, "finished")} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Finalizar">
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => deleteTournament(t.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Register players */}
        <div className="glass-card p-5 mt-4">
          <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Inscribir Jugadores</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {tournaments.filter(t => t.status === "registration").map(t => {
              const regs = registrations[t.id] || [];
              const unregistered = players.filter(p => !regs.includes(p.id));
              return (
                <div key={t.id} className="p-3 rounded-md bg-muted/20">
                  <h3 className="font-medium text-xs text-foreground mb-1">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{regs.length} inscriptos</p>
                  {unregistered.length > 0 ? (
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {unregistered.map(p => (
                        <button
                          key={p.id}
                          onClick={() => registerPlayerToTournament(t.id, p.id)}
                          className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors"
                        >
                          + {p.full_name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Todos inscriptos.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
