import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Register() {
  const { registerPlayer } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", dni: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    const result = await registerPlayer(form.full_name, form.dni, form.password);
    setLoading(false);
    if (result.success) {
      toast.success("¡Registro exitoso! Ya podés participar en torneos.");
      navigate("/");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-md">
        <h1 className="font-heading text-3xl font-bold text-foreground text-center mb-8">Registro de Jugador</h1>
        
        <div className="glass-card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre Completo</Label>
              <Input
                id="name"
                value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Nombre y Apellido"
                required
                maxLength={100}
              />
            </div>
            <div>
              <Label htmlFor="dni">DNI</Label>
              <Input
                id="dni"
                value={form.dni}
                onChange={e => setForm(p => ({ ...p, dni: e.target.value }))}
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
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                maxLength={50}
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar Contraseña</Label>
              <Input
                id="confirm"
                type="password"
                value={form.confirmPassword}
                onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Repetir contraseña"
                required
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              🏓 Al registrarte recibirás un rating inicial de <strong className="text-foreground">600 puntos</strong>.
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Registrando..." : "Registrarme"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tenés cuenta? <Link to="/login" className="text-foreground font-medium hover:underline">Ingresá</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
