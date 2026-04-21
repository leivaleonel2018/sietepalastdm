import { Swords, Trophy, Clock, TrendingUp } from "lucide-react";

interface SetScore {
  p1: number;
  p2: number;
}

interface ScoresheetProps {
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  setScores: SetScore[];
  winnerId: string | null;
  p1Id: string;
  p2Id: string;
  matchDate: string;
}

export function DigitalScoresheet({
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  setScores,
  winnerId,
  p1Id,
  p2Id,
  matchDate
}: ScoresheetProps) {
  const isP1Winner = winnerId === p1Id;
  const isP2Winner = winnerId === p2Id;

  // Determine if there was a comeback (e.g. losing first set but winning match)
  let p1Comeback = false;
  let p2Comeback = false;
  if (setScores.length > 2) {
    const p1LostFirst = setScores[0].p1 < setScores[0].p2;
    const p2LostFirst = setScores[0].p2 < setScores[0].p1;
    if (isP1Winner && p1LostFirst) p1Comeback = true;
    if (isP2Winner && p2LostFirst) p2Comeback = true;
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden w-full max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-primary/10 border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-heading font-semibold text-sm">
          <Swords className="w-4 h-4" /> Acta de Partido
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" /> {new Date(matchDate).toLocaleDateString("es-AR")}
        </div>
      </div>

      {/* Main Score */}
      <div className="px-6 py-6 flex items-center justify-between gap-4">
        {/* P1 */}
        <div className={`flex-1 flex flex-col ${isP1Winner ? 'items-end' : 'items-start opacity-70'} text-right`}>
          {isP1Winner && <Trophy className="w-4 h-4 text-yellow-500 mb-1" />}
          <span className="font-heading font-bold text-lg leading-tight line-clamp-1">{player1Name}</span>
          {p1Comeback && (
            <span className="text-[10px] uppercase tracking-widest text-orange-500 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Remontada
            </span>
          )}
        </div>

        {/* Global Score */}
        <div className="px-4 flex items-center gap-3">
          <span className={`text-4xl font-black font-heading ${isP1Winner ? 'text-primary' : 'text-foreground'}`}>
            {player1Score}
          </span>
          <span className="text-xl font-bold text-muted-foreground/30">-</span>
          <span className={`text-4xl font-black font-heading ${isP2Winner ? 'text-primary' : 'text-foreground'}`}>
            {player2Score}
          </span>
        </div>

        {/* P2 */}
        <div className={`flex-1 flex flex-col ${isP2Winner ? 'items-start' : 'items-end opacity-70'} text-left`}>
          {isP2Winner && <Trophy className="w-4 h-4 text-yellow-500 mb-1" />}
          <span className="font-heading font-bold text-lg leading-tight line-clamp-1">{player2Name}</span>
          {p2Comeback && (
            <span className="text-[10px] uppercase tracking-widest text-orange-500 font-bold mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Remontada
            </span>
          )}
        </div>
      </div>

      {/* Sets Breakdown */}
      <div className="bg-muted/30 px-6 py-4 flex flex-col gap-2 border-t border-border/50">
        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground text-center mb-1">
          Detalle de Sets
        </div>
        <div className="flex justify-center gap-4">
          {setScores.map((set, i) => {
            const p1WonSet = set.p1 > set.p2;
            const p2WonSet = set.p2 > set.p1;
            return (
              <div key={i} className="flex flex-col items-center">
                <span className="text-[10px] text-muted-foreground mb-1">Set {i + 1}</span>
                <div className="flex flex-col items-center bg-card border border-border/50 rounded-lg overflow-hidden min-w-[40px]">
                  <div className={`w-full text-center py-1.5 px-2 text-sm font-bold ${p1WonSet ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                    {set.p1}
                  </div>
                  <div className="w-full h-px bg-border/50" />
                  <div className={`w-full text-center py-1.5 px-2 text-sm font-bold ${p2WonSet ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                    {set.p2}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
