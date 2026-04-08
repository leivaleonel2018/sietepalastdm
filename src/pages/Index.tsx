import { Link } from "react-router-dom";
import { Trophy, Users, Star, ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import PointSystemTable from "@/components/PointSystemTable";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero */}
      <section className="nav-dark border-b border-border/10">
        <div className="container mx-auto px-4 py-16 md:py-20">
          <div className="max-w-xl">
            <h1 className="font-heading text-3xl md:text-4xl font-bold text-primary-foreground mb-3 leading-tight">
              TDM Siete Palmas
            </h1>
            <p className="text-primary-foreground/60 text-base mb-6 leading-relaxed">
              Torneos recreativos de tenis de mesa en Ciudad de Formosa. 
              Registrate, competí y subí en el ranking.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/registro"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-primary-foreground text-primary font-heading font-semibold text-sm hover:bg-primary-foreground/90 transition-all"
              >
                Registrarme <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/torneos"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-primary-foreground/70 font-heading font-semibold text-sm hover:text-primary-foreground transition-all border border-primary-foreground/20"
              >
                Ver Torneos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {[
            { icon: <Trophy className="w-5 h-5" />, title: "Torneos", desc: "Fase de grupos, eliminación directa, individuales y dobles." },
            { icon: <Users className="w-5 h-5" />, title: "Rankings", desc: "Sistema de rating basado en rendimiento partido a partido." },
            { icon: <Star className="w-5 h-5" />, title: "Comunidad", desc: "Competí con jugadores de tu nivel en un ambiente recreativo." },
          ].map((f, i) => (
            <div key={i} className="glass-card p-5">
              <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center text-foreground mb-3">
                {f.icon}
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-1">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Point System */}
        <div className="max-w-3xl mx-auto">
          <h2 className="font-heading text-xl font-bold text-foreground mb-4 text-center">Sistema de Puntos</h2>
          <PointSystemTable />
        </div>
      </section>
    </div>
  );
}
