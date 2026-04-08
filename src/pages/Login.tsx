import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Login() {
  const { loginPlayer, loginAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [playerForm, setPlayerForm] = useState({ dni: "", password: "" });
  const [adminForm, setAdminForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handlePlayerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await loginPlayer(playerForm.dni, playerForm.password);
    setLoading(false);
    if (result.success) {
      toast.success("¡Bienvenido!");
      navigate("/");
    } else {
      toast.error(result.error);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await loginAdmin(adminForm.username, adminForm.password);
    setLoading(false);
    if (result.success) {
      toast.success("¡Bienvenido, Admin!");
      navigate("/admin");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-md">
        <h1 className="font-heading text-3xl font-bold text-foreground text-center mb-8">Iniciar Sesión</h1>
        
        <Tabs defaultValue="player" className="glass-card p-6">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="player">Jugador</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          <TabsContent value="player">
            <form onSubmit={handlePlayerLogin} className="space-y-4">
              <div>
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={playerForm.dni}
                  onChange={e => setPlayerForm(p => ({ ...p, dni: e.target.value }))}
                  placeholder="Tu DNI"
                  required
                  maxLength={20}
                />
              </div>
              <div>
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={playerForm.password}
                  onChange={e => setPlayerForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Tu contraseña"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿No tenés cuenta? <Link to="/registro" className="text-foreground font-medium hover:underline">Registrate</Link>
              </p>
            </form>
          </TabsContent>

          <TabsContent value="admin">
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <Label htmlFor="admin-user">Usuario</Label>
                <Input
                  id="admin-user"
                  value={adminForm.username}
                  onChange={e => setAdminForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="Usuario admin"
                  required
                />
              </div>
              <div>
                <Label htmlFor="admin-pass">Contraseña</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={adminForm.password}
                  onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Contraseña admin"
                  required
                />
              </div>
              <Button type="submit" className="w-full gradient-accent text-accent-foreground" disabled={loading}>
                {loading ? "Ingresando..." : "Ingresar como Admin"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
