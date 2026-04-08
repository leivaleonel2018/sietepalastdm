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
import { Plus, Trophy, Trash2, Play, CheckCircle, Award } from "lucide-react";

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

  // Create tournament form
  const [newTournament, setNewTournament] = useState({
    name: "", description: "", format: "single_elimination", type: "singles",
    max_players: "", groups_count: "4"
  });

  // Record match form
  const [matchForm, setMatchForm] = useState({
    tournament_id: "", player1_id: "", player2_id: "",
    player1_score: "", player2_score: "", round: "", group_name: ""
  });

  // Placement form
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
    toast.success(`Puntos de instancia aplicados: ${data.points > 0 ? "+" : ""}${data.points}`);
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

  const selectedTournament = tournaments.find(t => t.id === matchForm.tournament_id);
  const tournamentPlayers = matchForm.tournament_id
    ? players.filter(p => (registrations[matchForm.tournament_id] || []).includes(p.id))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-heading text-3xl font-bold text-foreground mb-8 flex items-center gap-2">
          🛡️ Panel de Administración
        </h1>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Create Tournament */}
          <div className="glass-card p-6">
            <h2 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Crear Torneo
            </h2>
            <form onSubmit={createTournament} className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input value={newTournament.name} onChange={e => setNewTournament(p => ({...p, name: e.target.value}))} required maxLength={100} />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Input value={newTournament.description} onChange={e => setNewTournament(p => ({...p, description: e.target.value}))} maxLength={255} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Formato</Label>
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
                  <Label>Tipo</Label>
                  <Select value={newTournament.type} onValueChange={v => setNewTournament(p => ({...p, type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singles">Individual</SelectItem>
                      <SelectItem value="doubles">Dobles (2v2)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Máx. jugadores (opcional)</Label>
                  <Input type="number" value={newTournament.max_players} onChange={e => setNewTournament(p => ({...p, max_players: e.target.value}))} />
                </div>
                {(newTournament.format === "groups" || newTournament.format === "groups_then_elimination") && (
                  <div>
                    <Label>Cantidad de grupos</Label>
                    <Input type="number" value={newTournament.groups_count} onChange={e => setNewTournament(p => ({...p, groups_count: e.target.value}))} min="2" />
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground">Crear Torneo</Button>
            </form>
          </div>

          {/* Record Match */}
          <div className="glass-card p-6">
            <h2 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-secondary" /> Registrar Partido
            </h2>
            <form onSubmit={recordMatch} className="space-y-3">
              <div>
                <Label>Torneo</Label>
                <Select value={matchForm.tournament_id} onValueChange={v => setMatchForm(p => ({...p, tournament_id: v, player1_id: "", player2_id: ""}))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar torneo" /></SelectTrigger>
                  <SelectContent>
                    {tournaments.filter(t => t.status !== "finished").map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Jugador 1</Label>
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
                  <Label>Jugador 2</Label>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Sets J1</Label>
                  <Input type="number" value={matchForm.player1_score} onChange={e => setMatchForm(p => ({...p, player1_score: e.target.value}))} required min="0" />
                </div>
                <div>
                  <Label>Sets J2</Label>
                  <Input type="number" value={matchForm.player2_score} onChange={e => setMatchForm(p => ({...p, player2_score: e.target.value}))} required min="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ronda (opcional)</Label>
                  <Input value={matchForm.round} onChange={e => setMatchForm(p => ({...p, round: e.target.value}))} placeholder="ej: Cuartos" />
                </div>
                <div>
                  <Label>Grupo (opcional)</Label>
                  <Input value={matchForm.group_name} onChange={e => setMatchForm(p => ({...p, group_name: e.target.value}))} placeholder="ej: Grupo A" />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-accent text-accent-foreground" disabled={!matchForm.player1_id || !matchForm.player2_id}>
                Registrar Partido
              </Button>
            </form>
          </div>

          {/* Placement Points */}
          <div className="glass-card p-6">
            <h2 className="font-heading font-semibold text-lg text-foreground mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-secondary" /> Puntos por Instancia
            </h2>
            <form onSubmit={addPlacement} className="space-y-3">
              <div>
                <Label>Jugador</Label>
                <Select value={placementForm.player_id} onValueChange={v => setPlacementForm(p => ({...p, player_id: v}))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar jugador" /></SelectTrigger>
                  <SelectContent>
                    {players.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name} ({p.rating})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Instancia</Label>
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
              <Button type="submit" className="w-full" disabled={!placementForm.player_id || !placementForm.placement}>
                Aplicar Puntos
              </Button>
            </form>
          </div>

          {/* Manage Tournaments */}
          <div className="glass-card p-6">
            <h2 className="font-heading font-semibold text-lg text-foreground mb-4">Gestionar Torneos</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {tournaments.map(t => (
                <div key={t.id} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm text-foreground">{t.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({t.status === "registration" ? "Inscripción" : t.status === "in_progress" ? "En Curso" : "Finalizado"})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.status === "registration" && (
                      <button onClick={() => updateStatus(t.id, "in_progress")} className="p-1.5 rounded-md hover:bg-success/10 text-success" title="Iniciar">
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {t.status === "in_progress" && (
                      <button onClick={() => updateStatus(t.id, "finished")} className="p-1.5 rounded-md hover:bg-primary/10 text-primary" title="Finalizar">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => deleteTournament(t.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title="Eliminar">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Register players to tournaments */}
        <div className="glass-card p-6 mt-6">
          <h2 className="font-heading font-semibold text-lg text-foreground mb-4">Inscribir Jugadores a Torneos</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {tournaments.filter(t => t.status === "registration").map(t => {
              const regs = registrations[t.id] || [];
              const unregistered = players.filter(p => !regs.includes(p.id));
              return (
                <div key={t.id} className="p-4 rounded-lg bg-muted/20">
                  <h3 className="font-semibold text-foreground mb-2">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{regs.length} inscriptos</p>
                  {unregistered.length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {unregistered.map(p => (
                        <button
                          key={p.id}
                          onClick={() => registerPlayerToTournament(t.id, p.id)}
                          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-primary/10 transition-colors"
                        >
                          + {p.full_name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Todos los jugadores están inscriptos.</p>
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
