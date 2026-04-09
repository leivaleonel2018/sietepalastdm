import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { loginPlayer } = useAuth();
  const navigate = useNavigate();
  
  const [playerForm, setPlayerForm] = useState({ dni: "", password: "" });
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

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-md">
        <h1 className="font-heading text-3xl font-bold text-foreground text-center mb-8">Iniciar Sesión</h1>
        
        <div className="glass-card p-6">
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
        </div>
      </div>
    </div>
  );
}
