import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { adminAction } from "@/lib/api";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle, Award, Zap, LogIn, Newspaper, Image, Trophy, Users, Search, Shield, Swords } from "lucide-react";
import AnimatedList from "@/components/AnimatedList";

interface Tournament { id: string; name: string; format: string; type: string; status: string; max_players: number | null; groups_count: number | null; created_at: string; }
interface Player { id: string; full_name: string; rating: number; }
interface NewsItem { id: string; title: string; content: string; image_url: string | null; created_at: string; }
interface Badge { id: string; name: string; description: string | null; icon_url: string | null; type: string; }

export default function AdminPanel() {
  const { isAdmin, adminToken, loginAdmin } = useAuth();
  const [adminForm, setAdminForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"tournaments" | "news" | "players" | "badges">("tournaments");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, string[]>>({});
  const [news, setNews] = useState<NewsItem[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);

  const [newTournament, setNewTournament] = useState({ name: "", description: "", format: "single_elimination", type: "singles", max_players: "", groups_count: "4" });
  const [newsForm, setNewsForm] = useState({ title: "", content: "" });
  const [newsImage, setNewsImage] = useState<File | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [placementForm, setPlacementForm] = useState({ player_id: "", placement: "" });
  const [playerSearch, setPlayerSearch] = useState("");
  const [badgeForm, setBadgeForm] = useState({ name: "", description: "", icon_url: "", type: "manual" });
  const [awardForm, setAwardForm] = useState({ player_id: "", badge_id: "" });
  const [editRatingForm, setEditRatingForm] = useState({ player_id: "", rating: "" });
  const [challengeForm, setChallengeForm] = useState({ challenger_id: "", challenged_id: "" });

  useEffect(() => { if (isAdmin) fetchAll(); }, [isAdmin]);

  const fetchAll = async () => {
    const [t, p, r, n, b] = await Promise.all([
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
      supabase.from("players").select("id, full_name, rating").order("full_name"),
      supabase.from("tournament_registrations").select("tournament_id, player_id"),
      supabase.from("news").select("*").order("created_at", { ascending: false }),
      supabase.from("badges").select("*").order("created_at"),
    ]);
    setTournaments(t.data || []);
    setPlayers(p.data || []);
    const regsMap: Record<string, string[]> = {};
    (r.data || []).forEach((reg: any) => { if (!regsMap[reg.tournament_id]) regsMap[reg.tournament_id] = []; regsMap[reg.tournament_id].push(reg.player_id); });
    setRegistrations(regsMap);
    setNews((n.data || []) as NewsItem[]);
    setBadges((b.data || []) as Badge[]);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const result = await loginAdmin(adminForm.username, adminForm.password);
    setLoginLoading(false);
    if (result.success) toast.success("¡Bienvenido, Admin!");
    else toast.error(result.error);
  };

  const createTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const data = await adminAction("create_tournament", {
      name: newTournament.name, description: newTournament.description || null, format: newTournament.format, type: newTournament.type,
      max_players: newTournament.max_players ? parseInt(newTournament.max_players) : null, groups_count: parseInt(newTournament.groups_count),
    }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Torneo creado");
    setNewTournament({ name: "", description: "", format: "single_elimination", type: "singles", max_players: "", groups_count: "4" });
    fetchAll();
  };

  const updateStatus = async (id: string, status: string) => { if (!adminToken) return; await adminAction("update_tournament_status", { tournament_id: id, status }, adminToken); toast.success("Estado actualizado"); fetchAll(); };
  const deleteTournament = async (id: string) => { if (!adminToken || !confirm("¿Eliminar este torneo?")) return; await adminAction("delete_tournament", { tournament_id: id }, adminToken); toast.success("Torneo eliminado"); fetchAll(); };
  const generateBracket = async (tournamentId: string) => { if (!adminToken) return; const data = await adminAction("generate_bracket", { tournament_id: tournamentId }, adminToken); if (data.error) { toast.error(data.error); return; } toast.success(`Bracket generado: ${data.matches_created} partidos`); fetchAll(); };
  const addPlacement = async (e: React.FormEvent) => { e.preventDefault(); if (!adminToken) return; const data = await adminAction("add_placement_points", { player_id: placementForm.player_id, placement: placementForm.placement }, adminToken); if (data.error) { toast.error(data.error); return; } toast.success(`Puntos: ${data.points > 0 ? "+" : ""}${data.points}`); setPlacementForm({ player_id: "", placement: "" }); fetchAll(); };
  const registerPlayerToTournament = async (tournamentId: string, playerId: string) => { if (!adminToken) return; const data = await adminAction("register_player_tournament", { tournament_id: tournamentId, player_id: playerId }, adminToken); if (data.error) { toast.error(data.error); return; } toast.success("Jugador inscripto"); fetchAll(); };

  const deletePlayer = async (playerId: string, name: string) => {
    if (!adminToken || !confirm(`¿Eliminar a ${name}? Esto borrará todos sus datos.`)) return;
    const data = await adminAction("delete_player", { player_id: playerId }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Jugador eliminado");
    fetchAll();
  };

  const editPlayerRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const data = await adminAction("edit_rating", { player_id: editRatingForm.player_id, rating: editRatingForm.rating }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Rating actualizado");
    setEditRatingForm({ player_id: "", rating: "" });
    fetchAll();
  };

  const adminCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    if (challengeForm.challenger_id === challengeForm.challenged_id) { toast.error("Jugadores iguales"); return; }
    const data = await adminAction("admin_create_challenge", { challenger_id: challengeForm.challenger_id, challenged_id: challengeForm.challenged_id }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Desafío creado como Aceptado");
    setChallengeForm({ challenger_id: "", challenged_id: "" });
  };

  const publishNews = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setNewsLoading(true);
    let image_url: string | null = null;
    if (newsImage) {
      const ext = newsImage.name.split(".").pop();
      const path = `${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("news-images").upload(path, newsImage);
      if (error) { toast.error("Error subiendo imagen"); setNewsLoading(false); return; }
      const { data: urlData } = supabase.storage.from("news-images").getPublicUrl(path);
      image_url = urlData.publicUrl;
    }
    const data = await adminAction("create_news", { title: newsForm.title, content: newsForm.content, image_url }, adminToken);
    setNewsLoading(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Noticia publicada");
    setNewsForm({ title: "", content: "" });
    setNewsImage(null);
    fetchAll();
  };

  const deleteNews = async (newsId: string) => { if (!adminToken || !confirm("¿Eliminar esta noticia?")) return; await adminAction("delete_news", { news_id: newsId }, adminToken); toast.success("Noticia eliminada"); fetchAll(); };

  const createBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const data = await adminAction("create_badge", badgeForm, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Insignia creada");
    setBadgeForm({ name: "", description: "", icon_url: "", type: "manual" });
    fetchAll();
  };

  const deleteBadge = async (badgeId: string) => { if (!adminToken || !confirm("¿Eliminar insignia?")) return; await adminAction("delete_badge", { badge_id: badgeId }, adminToken); toast.success("Insignia eliminada"); fetchAll(); };

  const awardBadge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const data = await adminAction("award_badge", { player_id: awardForm.player_id, badge_id: awardForm.badge_id }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Insignia otorgada");
    setAwardForm({ player_id: "", badge_id: "" });
  };

  const revokeBadge = async (playerId: string, badgeId: string) => {
    if (!adminToken || !confirm("¿Revocar insignia?")) return;
    await adminAction("revoke_badge", { player_id: playerId, badge_id: badgeId }, adminToken);
    toast.success("Insignia revocada");
  };

  const filteredPlayers = players.filter(p => p.full_name.toLowerCase().includes(playerSearch.toLowerCase()));

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-sm">
          <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-6">Panel de Admin</h1>
          <div className="glass-card p-6">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div><Label htmlFor="admin-user">Usuario</Label><Input id="admin-user" value={adminForm.username} onChange={e => setAdminForm(p => ({ ...p, username: e.target.value }))} placeholder="Usuario" required /></div>
              <div><Label htmlFor="admin-pass">Contraseña</Label><Input id="admin-pass" type="password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} placeholder="Contraseña" required /></div>
              <Button type="submit" className="w-full" disabled={loginLoading}><LogIn className="w-4 h-4 mr-1" />{loginLoading ? "Ingresando..." : "Ingresar"}</Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <h1 className="font-heading text-2xl font-bold text-foreground mb-4 flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Panel de Admin</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit flex-wrap">
          {[
            { id: "tournaments" as const, label: "Torneos", icon: <Trophy className="w-4 h-4" /> },
            { id: "news" as const, label: "Noticias", icon: <Newspaper className="w-4 h-4" /> },
            { id: "players" as const, label: "Jugadores", icon: <Users className="w-4 h-4" /> },
            { id: "badges" as const, label: "Insignias", icon: <Award className="w-4 h-4" /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* TOURNAMENTS TAB */}
        {activeTab === "tournaments" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Crear Torneo</h2>
              <form onSubmit={createTournament} className="space-y-2.5">
                <div><Label className="text-xs">Nombre</Label><Input value={newTournament.name} onChange={e => setNewTournament(p => ({...p, name: e.target.value}))} required maxLength={100} /></div>
                <div><Label className="text-xs">Descripción</Label><Input value={newTournament.description} onChange={e => setNewTournament(p => ({...p, description: e.target.value}))} maxLength={255} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Formato</Label>
                    <Select value={newTournament.format} onValueChange={v => setNewTournament(p => ({...p, format: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="single_elimination">Eliminación Directa</SelectItem><SelectItem value="groups">Fase de Grupos</SelectItem><SelectItem value="groups_then_elimination">Grupos + Eliminación</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Tipo</Label>
                    <Select value={newTournament.type} onValueChange={v => setNewTournament(p => ({...p, type: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="singles">Individual</SelectItem><SelectItem value="doubles">Dobles</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Máx. jugadores (opc.)</Label><Input type="number" value={newTournament.max_players} onChange={e => setNewTournament(p => ({...p, max_players: e.target.value}))} placeholder="Sin límite" /></div>
                  {(newTournament.format === "groups" || newTournament.format === "groups_then_elimination") && (
                    <div><Label className="text-xs">Grupos</Label><Input type="number" value={newTournament.groups_count} onChange={e => setNewTournament(p => ({...p, groups_count: e.target.value}))} min="2" /></div>
                  )}
                </div>
                <Button type="submit" className="w-full">Crear Torneo</Button>
              </form>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Gestionar Torneos</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tournaments.map(t => {
                  const regs = registrations[t.id] || [];
                  return (
                    <div key={t.id} className="p-3 rounded-lg bg-muted/30 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-xs text-foreground">{t.name}</span>
                        <span className="text-xs text-muted-foreground ml-1.5">
                          {t.status === "registration" ? "Inscripción" : t.status === "in_progress" ? "En Curso" : "Fin"} · {regs.length} jugadores
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {t.status === "registration" && regs.length >= 2 && (
                          <button onClick={() => generateBracket(t.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Generar bracket e iniciar"><Zap className="w-3.5 h-3.5" /></button>
                        )}
                        {t.status === "in_progress" && (
                          <button onClick={() => updateStatus(t.id, "finished")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Finalizar"><CheckCircle className="w-3.5 h-3.5" /></button>
                        )}
                        <button onClick={() => deleteTournament(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Puntos por Instancia</h2>
              <form onSubmit={addPlacement} className="space-y-2.5">
                <div><Label className="text-xs">Jugador</Label>
                  <Select value={placementForm.player_id} onValueChange={v => setPlacementForm(p => ({...p, player_id: v}))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{players.map(p => (<SelectItem key={p.id} value={p.id}>{p.full_name} ({p.rating})</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Instancia</Label>
                  <Select value={placementForm.placement} onValueChange={v => setPlacementForm(p => ({...p, placement: v}))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="campeon">Campeón (+30)</SelectItem><SelectItem value="subcampeon">Sub-Campeón (+25)</SelectItem>
                      <SelectItem value="tercero">Tercero (+21)</SelectItem><SelectItem value="4to">4° (+17)</SelectItem>
                      <SelectItem value="8vo">8° (+13)</SelectItem><SelectItem value="16vo">16° (+10)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" variant="outline" disabled={!placementForm.player_id || !placementForm.placement}>Aplicar Puntos</Button>
              </form>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Inscribir Jugadores</h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {tournaments.filter(t => t.status === "registration").map(t => {
                  const regs = registrations[t.id] || [];
                  const unregistered = players.filter(p => !regs.includes(p.id));
                  return (
                    <div key={t.id} className="p-3 rounded-lg bg-muted/20">
                      <h3 className="font-medium text-xs text-foreground mb-1">{t.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{regs.length} inscriptos</p>
                      {unregistered.length > 0 ? (
                        <div className="space-y-0.5 max-h-32 overflow-y-auto">
                          {unregistered.map(p => (
                            <button key={p.id} onClick={() => registerPlayerToTournament(t.id, p.id)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors">+ {p.full_name}</button>
                          ))}
                        </div>
                      ) : <p className="text-xs text-muted-foreground">Todos inscriptos.</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* NEWS TAB */}
        {activeTab === "news" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Publicar Noticia</h2>
              <form onSubmit={publishNews} className="space-y-3">
                <div><Label className="text-xs">Título</Label><Input value={newsForm.title} onChange={e => setNewsForm(p => ({ ...p, title: e.target.value }))} required maxLength={200} placeholder="Título" /></div>
                <div><Label className="text-xs">Contenido</Label><Textarea value={newsForm.content} onChange={e => setNewsForm(p => ({ ...p, content: e.target.value }))} required placeholder="Contenido..." rows={5} /></div>
                <div><Label className="text-xs flex items-center gap-1"><Image className="w-3 h-3" /> Imagen (opc.)</Label><Input type="file" accept="image/*" onChange={e => setNewsImage(e.target.files?.[0] || null)} className="text-xs" /></div>
                <Button type="submit" className="w-full" disabled={newsLoading}>{newsLoading ? "Publicando..." : "Publicar"}</Button>
              </form>
            </div>
            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Noticias Publicadas</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {news.length === 0 ? <p className="text-xs text-muted-foreground">No hay noticias.</p> : news.map(n => (
                  <div key={n.id} className="p-3 rounded-lg bg-muted/30 flex items-start gap-3">
                    {n.image_url && <img src={n.image_url} alt="" className="w-16 h-12 rounded object-cover flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-medium text-foreground truncate">{n.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                    </div>
                    <button onClick={() => deleteNews(n.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PLAYERS TAB */}
        {activeTab === "players" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-semibold text-sm text-foreground">Jugadores ({players.length})</h2>
                <div className="relative w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} placeholder="Buscar..." className="pl-9 h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1 max-h-[32rem] overflow-y-auto">
                {filteredPlayers.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm group">
                    <span className="text-foreground font-medium">{p.full_name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-heading font-semibold">{p.rating}</span>
                      <button onClick={() => deletePlayer(p.id, p.full_name)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {filteredPlayers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sin resultados</p>}
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="glass-card p-5">
                <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Award className="w-4 h-4" /> Editar Rating Manual</h2>
                <form onSubmit={editPlayerRating} className="space-y-2.5">
                  <div><Label className="text-xs">Jugador</Label>
                    <Select value={editRatingForm.player_id} onValueChange={v => {
                      const p = players.find(x => x.id === v);
                      setEditRatingForm({ player_id: v, rating: p ? p.rating.toString() : "" });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{players.map(p => (<SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Nuevo Rating</Label>
                    <Input type="number" value={editRatingForm.rating} onChange={e => setEditRatingForm(p => ({...p, rating: e.target.value}))} required />
                  </div>
                  <Button type="submit" className="w-full" variant="outline" disabled={!editRatingForm.player_id || !editRatingForm.rating}>Actualizar Rating</Button>
                </form>
              </div>

              <div className="glass-card p-5">
                <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Swords className="w-4 h-4" /> Crear Desafío</h2>
                <form onSubmit={adminCreateChallenge} className="space-y-2.5">
                  <div><Label className="text-xs">Jugador 1</Label>
                    <Select value={challengeForm.challenger_id} onValueChange={v => setChallengeForm(p => ({...p, challenger_id: v}))}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{players.map(p => (<SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-xs">Jugador 2</Label>
                    <Select value={challengeForm.challenged_id} onValueChange={v => setChallengeForm(p => ({...p, challenged_id: v}))}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>{players.map(p => (<SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" variant="outline" disabled={!challengeForm.challenger_id || !challengeForm.challenged_id}>Forzar Desafío</Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">Ir a la pestaña de Desafíos en la app para registrar el resultado.</p>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* BADGES TAB */}
        {activeTab === "badges" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Crear Insignia</h2>
              <form onSubmit={createBadge} className="space-y-2.5">
                <div><Label className="text-xs">Nombre</Label><Input value={badgeForm.name} onChange={e => setBadgeForm(p => ({...p, name: e.target.value}))} required placeholder="Nombre" /></div>
                <div><Label className="text-xs">Descripción</Label><Input value={badgeForm.description} onChange={e => setBadgeForm(p => ({...p, description: e.target.value}))} placeholder="Descripción" /></div>
                <div><Label className="text-xs">Emoji/Ícono</Label><Input value={badgeForm.icon_url} onChange={e => setBadgeForm(p => ({...p, icon_url: e.target.value}))} placeholder="🏆 o URL" /></div>
                <div><Label className="text-xs">Tipo</Label>
                  <Select value={badgeForm.type} onValueChange={v => setBadgeForm(p => ({...p, type: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="automatic">Automática</SelectItem><SelectItem value="tournament">Torneo</SelectItem></SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Crear Insignia</Button>
              </form>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Insignias existentes</h2>
              <div className="space-y-1.5 max-h-64 overflow-y-auto mb-4">
                {badges.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{b.icon_url && b.icon_url.length <= 4 ? b.icon_url : "🏅"}</span>
                      <div>
                        <span className="font-medium text-foreground">{b.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{b.type}</span>
                      </div>
                    </div>
                    <button onClick={() => deleteBadge(b.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>

              <h3 className="font-heading font-semibold text-xs text-foreground mb-2">Otorgar Insignia</h3>
              <form onSubmit={awardBadge} className="space-y-2">
                <Select value={awardForm.player_id} onValueChange={v => setAwardForm(p => ({...p, player_id: v}))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Jugador" /></SelectTrigger>
                  <SelectContent>{players.map(p => (<SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>))}</SelectContent>
                </Select>
                <Select value={awardForm.badge_id} onValueChange={v => setAwardForm(p => ({...p, badge_id: v}))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Insignia" /></SelectTrigger>
                  <SelectContent>{badges.map(b => (<SelectItem key={b.id} value={b.id}>{b.icon_url && b.icon_url.length <= 4 ? b.icon_url : "🏅"} {b.name}</SelectItem>))}</SelectContent>
                </Select>
                <Button type="submit" variant="outline" className="w-full" disabled={!awardForm.player_id || !awardForm.badge_id}>Otorgar</Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
