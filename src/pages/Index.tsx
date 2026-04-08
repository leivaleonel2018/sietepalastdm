import { Link } from "react-router-dom";
import { Trophy, Users, Star, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import PointSystemTable from "@/components/PointSystemTable";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-secondary blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 rounded-full bg-primary-foreground blur-3xl" />
        </div>
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-2xl">
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-primary-foreground mb-4 leading-tight">
              TDM Siete Palmas
            </h1>
            <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed">
              Torneos recreativos de tenis de mesa en Ciudad de Formosa. 
              Registrate, competí y subí en el ranking.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/registro"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-accent text-accent-foreground font-heading font-semibold hover:opacity-90 transition-all shadow-lg"
              >
                Registrarme <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/torneos"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-foreground/10 text-primary-foreground font-heading font-semibold hover:bg-primary-foreground/20 transition-all border border-primary-foreground/20"
              >
                Ver Torneos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: <Trophy className="w-8 h-8" />, title: "Torneos", desc: "Fase de grupos, eliminación directa, individuales y dobles." },
            { icon: <Users className="w-8 h-8" />, title: "Rankings", desc: "Sistema de rating basado en rendimiento partido a partido." },
            { icon: <Star className="w-8 h-8" />, title: "Comunidad", desc: "Competí con jugadores de tu nivel en un ambiente recreativo." },
          ].map((f, i) => (
            <div key={i} className="glass-card p-6 hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground mb-4">
                {f.icon}
              </div>
              <h3 className="font-heading font-semibold text-lg text-foreground mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Point System */}
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-2xl font-bold text-foreground mb-6 text-center">Sistema de Puntos</h2>
          <PointSystemTable />
        </div>
      </section>
    </div>
  );
}
