import Navbar from "@/components/Navbar";
import PointSystemTable from "@/components/PointSystemTable";
import { BookOpen, Swords, Trophy, Target } from "lucide-react";

export default function Rules() {
  return (
    <div className="min-h-screen bg-background ping-pong-pattern">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="font-heading text-3xl font-bold text-foreground mb-2 flex items-center justify-center gap-3">
            <BookOpen className="w-7 h-7 text-primary" /> Reglas y Sistema de Puntos
          </h1>
          <p className="text-muted-foreground">Todo lo que necesitás saber sobre el sistema de rating y torneos</p>
        </div>

        {/* General rules */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { icon: <Trophy className="w-5 h-5" />, title: "Torneos", desc: "Se juegan al mejor de 3 sets. La final es al mejor de 5. El admin genera brackets o grupos y registra resultados." },
            { icon: <Swords className="w-5 h-5" />, title: "Desafíos", desc: "Podés desafiar a cualquier jugador desde su perfil. Se juegan al mejor de 3 sets. Los jugadores registran el resultado." },
            { icon: <Target className="w-5 h-5" />, title: "Rating", desc: "Todos empiezan en 600. El rating cambia con cada partido según la diferencia de nivel entre los jugadores." },
          ].map((r, i) => (
            <div key={i} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                {r.icon}
              </div>
              <h3 className="font-heading font-semibold text-foreground mb-1">{r.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>

        <div className="animate-slide-up stagger-3">
          <PointSystemTable />
        </div>
      </div>
    </div>
  );
}
