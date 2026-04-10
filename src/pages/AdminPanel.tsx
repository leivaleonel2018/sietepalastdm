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
import { Plus, Trash2, Play, CheckCircle, Award, Zap, LogIn, Newspaper, Image, Trophy, Users } from "lucide-react";

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

interface NewsItem {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

export default function AdminPanel() {
  const { isAdmin, adminToken, loginAdmin } = useAuth();
  const [adminForm, setAdminForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"tournaments" | "news" | "players">("tournaments");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [registrations, setRegistrations] = useState<Record<string, string[]>>({});
  const [news, setNews] = useState<NewsItem[]>([]);

  const [newTournament, setNewTournament] = useState({
    name: "", description: "", format: "single_elimination", type: "singles",
    max_players: "", groups_count: "4"
  });

  const [newsForm, setNewsForm] = useState({ title: "", content: "" });
  const [newsImage, setNewsImage] = useState<File | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);

  const [placementForm, setPlacementForm] = useState({ player_id: "", placement: "" });

  useEffect(() => {
    if (isAdmin) fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    const [t, p, r, n] = await Promise.all([
      supabase.from("tournaments").select("*").order("created_at", { ascending: false }),
      supabase.from("players").select("id, full_name, rating").order("full_name"),
      supabase.from("tournament_registrations").select("tournament_id, player_id"),
      supabase.from("news").select("*").order("created_at", { ascending: false }),
    ]);
    setTournaments(t.data || []);
    setPlayers(p.data || []);
    const regsMap: Record<string, string[]> = {};
    (r.data || []).forEach((reg: any) => {
      if (!regsMap[reg.tournament_id]) regsMap[reg.tournament_id] = [];
      regsMap[reg.tournament_id].push(reg.player_id);
    });
    setRegistrations(regsMap);
    setNews((n.data || []) as NewsItem[]);
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
    toast.success(`Bracket generado: ${data.matches_created} partidos`);
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
    toast.success(`Puntos: ${data.points > 0 ? "+" : ""}${data.points}`);
    setPlacementForm({ player_id: "", placement: "" });
    fetchAll();
  };

  const registerPlayerToTournament = async (tournamentId: string, playerId: string) => {
    if (!adminToken) return;
    const data = await adminAction("register_player_tournament", { tournament_id: tournamentId, player_id: playerId }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Jugador inscripto");
    fetchAll();
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
      if (error) {
        toast.error("Error subiendo imagen");
        setNewsLoading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("news-images").getPublicUrl(path);
      image_url = urlData.publicUrl;
    }

    const data = await adminAction("create_news", {
      title: newsForm.title,
      content: newsForm.content,
      image_url,
    }, adminToken);

    setNewsLoading(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Noticia publicada");
    setNewsForm({ title: "", content: "" });
    setNewsImage(null);
    fetchAll();
  };

  const deleteNews = async (newsId: string) => {
    if (!adminToken || !confirm("¿Eliminar esta noticia?")) return;
    const data = await adminAction("delete_news", { news_id: newsId }, adminToken);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Noticia eliminada");
    fetchAll();
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 max-w-sm">
          <h1 className="font-heading text-2xl font-bold text-foreground text-center mb-6">Panel de Admin</h1>
          <div className="glass-card p-6">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <Label htmlFor="admin-user">Usuario</Label>
                <Input id="admin-user" value={adminForm.username} onChange={e => setAdminForm(p => ({ ...p, username: e.target.value }))} placeholder="Usuario" required />
              </div>
              <div>
                <Label htmlFor="admin-pass">Contraseña</Label>
                <Input id="admin-pass" type="password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} placeholder="Contraseña" required />
              </div>
              <Button type="submit" className="w-full" disabled={loginLoading}>
                <LogIn className="w-4 h-4 mr-1" />{loginLoading ? "Ingresando..." : "Ingresar"}
              </Button>
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
        <h1 className="font-heading text-2xl font-bold text-foreground mb-4">Panel de Admin</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-lg w-fit">
          {[
            { id: "tournaments" as const, label: "Torneos", icon: <Trophy className="w-4 h-4" /> },
            { id: "news" as const, label: "Noticias", icon: <Newspaper className="w-4 h-4" /> },
            { id: "players" as const, label: "Jugadores", icon: <Users className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* TOURNAMENTS TAB */}
        {activeTab === "tournaments" && (
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
                  <Label className="text-xs">Descripción</Label>
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
                        <SelectItem value="doubles">Dobles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Máx. jugadores (opcional)</Label>
                    <Input type="number" value={newTournament.max_players} onChange={e => setNewTournament(p => ({...p, max_players: e.target.value}))} placeholder="Sin límite" />
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

            {/* Manage Tournaments */}
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
                          <button onClick={() => generateBracket(t.id)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Generar bracket e iniciar">
                            <Zap className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {t.status === "in_progress" && (
                          <button onClick={() => updateStatus(t.id, "finished")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Finalizar">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => deleteTournament(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Eliminar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                      {players.map(p => (<SelectItem key={p.id} value={p.id}>{p.full_name} ({p.rating})</SelectItem>))}
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
                      <SelectItem value="4to">4° (+17)</SelectItem>
                      <SelectItem value="8vo">8° (+13)</SelectItem>
                      <SelectItem value="16vo">16° (+10)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" variant="outline" disabled={!placementForm.player_id || !placementForm.placement}>
                  Aplicar Puntos
                </Button>
              </form>
            </div>

            {/* Register Players */}
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
                            <button key={p.id} onClick={() => registerPlayerToTournament(t.id, p.id)} className="w-full text-left px-2 py-1 text-xs rounded hover:bg-muted transition-colors">
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
        )}

        {/* NEWS TAB */}
        {activeTab === "news" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4" /> Publicar Noticia
              </h2>
              <form onSubmit={publishNews} className="space-y-3">
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={newsForm.title} onChange={e => setNewsForm(p => ({ ...p, title: e.target.value }))} required maxLength={200} placeholder="Título de la noticia" />
                </div>
                <div>
                  <Label className="text-xs">Contenido</Label>
                  <Textarea value={newsForm.content} onChange={e => setNewsForm(p => ({ ...p, content: e.target.value }))} required placeholder="Escribí el contenido de la noticia..." rows={5} />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Image className="w-3 h-3" /> Imagen (opcional)</Label>
                  <Input type="file" accept="image/*" onChange={e => setNewsImage(e.target.files?.[0] || null)} className="text-xs" />
                </div>
                <Button type="submit" className="w-full" disabled={newsLoading}>
                  {newsLoading ? "Publicando..." : "Publicar Noticia"}
                </Button>
              </form>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Noticias Publicadas</h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {news.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay noticias.</p>
                ) : news.map(n => (
                  <div key={n.id} className="p-3 rounded-lg bg-muted/30 flex items-start gap-3">
                    {n.image_url && (
                      <img src={n.image_url} alt="" className="w-16 h-12 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-medium text-foreground truncate">{n.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
                      <span className="text-xs text-muted-foreground/60">{new Date(n.created_at).toLocaleDateString("es-AR")}</span>
                    </div>
                    <button onClick={() => deleteNews(n.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PLAYERS TAB */}
        {activeTab === "players" && (
          <div className="glass-card p-5">
            <h2 className="font-heading font-semibold text-sm text-foreground mb-3">Jugadores Registrados ({players.length})</h2>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {players.map((p, i) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 text-sm">
                  <span className="text-foreground font-medium">{p.full_name}</span>
                  <span className="text-muted-foreground font-heading font-semibold">{p.rating}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
