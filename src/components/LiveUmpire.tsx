import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Clock, Play, Pause, Square, Minus, Plus, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface SetScore {
  p1: number;
  p2: number;
}

interface LiveUmpireProps {
  player1Name: string;
  player2Name: string;
  maxSets?: 3 | 5;
  onFinishMatch: (sets: SetScore[], durationSeconds: number) => void;
  onCancel: () => void;
}

export function LiveUmpire({
  player1Name,
  player2Name,
  maxSets = 3,
  onFinishMatch,
  onCancel
}: LiveUmpireProps) {
  const [sets, setSets] = useState<SetScore[]>([]);
  const [currentP1Score, setCurrentP1Score] = useState(0);
  const [currentP2Score, setCurrentP2Score] = useState(0);
  
  // Timer logic
  const [timeSeconds, setTimeSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Match state
  const [matchFinished, setMatchFinished] = useState(false);
  const neededWins = maxSets === 5 ? 3 : 2;

  useEffect(() => {
    let interval: any;
    if (isTimerRunning && !matchFinished) {
      interval = setInterval(() => {
        setTimeSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, matchFinished]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleScore = (player: 1 | 2, change: number) => {
    if (matchFinished) return;
    if (!isTimerRunning && timeSeconds === 0) setIsTimerRunning(true);
    
    if (player === 1) {
      setCurrentP1Score(prev => Math.max(0, prev + change));
    } else {
      setCurrentP2Score(prev => Math.max(0, prev + change));
    }
  };

  const finishCurrentSet = () => {
    if (currentP1Score === 0 && currentP2Score === 0) {
      toast.error("El set está en 0-0");
      return;
    }
    
    // Check standard Ping Pong rules (optional enforcement, but letting umpire decide when set is done)
    if (currentP1Score < 11 && currentP2Score < 11) {
      if (!window.confirm("¿Terminar set sin llegar a 11 puntos?")) return;
    }
    if (Math.abs(currentP1Score - currentP2Score) < 2) {
      if (!window.confirm("¿Terminar set sin diferencia de 2 puntos?")) return;
    }

    const newSets = [...sets, { p1: currentP1Score, p2: currentP2Score }];
    setSets(newSets);
    setCurrentP1Score(0);
    setCurrentP2Score(0);

    // Check if match is won
    let p1Wins = 0;
    let p2Wins = 0;
    newSets.forEach(s => {
      if (s.p1 > s.p2) p1Wins++;
      else if (s.p2 > s.p1) p2Wins++;
    });

    if (p1Wins >= neededWins || p2Wins >= neededWins) {
      setMatchFinished(true);
      setIsTimerRunning(false);
      toast.success("¡Partido finalizado!");
    }
  };

  const undoLastSet = () => {
    if (sets.length === 0) return;
    const newSets = [...sets];
    const lastSet = newSets.pop()!;
    setSets(newSets);
    setCurrentP1Score(lastSet.p1);
    setCurrentP2Score(lastSet.p2);
    setMatchFinished(false);
  };

  const p1SetsWon = sets.filter(s => s.p1 > s.p2).length;
  const p2SetsWon = sets.filter(s => s.p2 > s.p1).length;

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-3xl bg-background border-border/50 p-0 overflow-hidden shadow-2xl">
        <DialogTitle className="sr-only">Arbitraje Digital en Vivo</DialogTitle>
        <DialogDescription className="sr-only">Pantalla de anotación en tiempo real para el partido.</DialogDescription>
        
        <div className="flex flex-col h-[85vh] max-h-[800px]">
          {/* Header */}
          <div className="bg-muted px-4 py-3 flex items-center justify-between border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isTimerRunning ? 'bg-red-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="font-heading font-bold text-foreground tracking-widest uppercase text-xs">
                Arbitraje en Vivo
              </span>
            </div>
            
            {/* Timer Controls */}
            <div className="flex items-center gap-4">
              <span className="font-mono text-xl font-bold text-primary tabular-nums">
                {formatTime(timeSeconds)}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => setIsTimerRunning(!isTimerRunning)} disabled={matchFinished}>
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-white/10" onClick={() => { setTimeSeconds(0); setIsTimerRunning(false); }} disabled={matchFinished || timeSeconds === 0}>
                  <RefreshCcw className="w-3 h-3 text-muted-foreground" />
                </Button>
              </div>
            </div>
          </div>

          {/* Sets Timeline */}
          <div className="bg-card/50 py-3 px-6 border-b border-border/30 flex justify-center gap-8">
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Set {sets.length + 1}</span>
              <div className="text-xs text-foreground font-medium">Mejor de {maxSets}</div>
            </div>
            
            <div className="flex gap-2">
              {sets.map((set, i) => (
                <div key={i} className="flex flex-col text-center w-12 bg-muted/50 rounded-md overflow-hidden border border-border/30">
                  <div className={`py-1 text-xs font-bold ${set.p1 > set.p2 ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}>{set.p1}</div>
                  <div className="h-px bg-border/30" />
                  <div className={`py-1 text-xs font-bold ${set.p2 > set.p1 ? 'bg-primary/20 text-primary' : 'text-muted-foreground'}`}>{set.p2}</div>
                </div>
              ))}
              {sets.length > 0 && !matchFinished && (
                <button onClick={undoLastSet} className="text-[10px] text-muted-foreground hover:text-foreground underline px-2 self-center">Deshacer</button>
              )}
            </div>
          </div>

          {/* Main Score Area */}
          <div className="flex-1 grid grid-cols-2 divide-x divide-border/20">
            {/* Player 1 */}
            <div className="flex flex-col bg-card relative">
              <div className="p-4 text-center border-b border-border/10 bg-black/20">
                <h3 className="font-heading font-bold text-xl text-foreground truncate">{player1Name}</h3>
                <div className="text-sm font-medium text-primary mt-1">Sets ganados: {p1SetsWon}</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 relative group">
                <span className="text-[12rem] font-black font-heading tabular-nums leading-none text-foreground group-hover:scale-105 transition-transform select-none">
                  {currentP1Score}
                </span>
                {/* Invisible massive button area for tapping on mobile */}
                <button 
                  className="absolute inset-0 z-10 focus:outline-none focus-visible:bg-white/5 active:bg-white/5 transition-colors"
                  onClick={() => handleScore(1, 1)}
                  disabled={matchFinished}
                  aria-label={`Sumar punto a ${player1Name}`}
                />
              </div>
              <div className="p-4 bg-black/20 flex justify-center gap-4 z-20 relative">
                <Button size="lg" variant="destructive" className="h-16 w-20 rounded-2xl" onClick={() => handleScore(1, -1)} disabled={currentP1Score === 0 || matchFinished}>
                  <Minus className="w-8 h-8" />
                </Button>
                <Button size="lg" className="h-16 flex-1 rounded-2xl text-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)]" onClick={() => handleScore(1, 1)} disabled={matchFinished}>
                  <Plus className="w-8 h-8 mr-2" /> 1
                </Button>
              </div>
            </div>

            {/* Player 2 */}
            <div className="flex flex-col bg-card relative">
              <div className="p-4 text-center border-b border-border/10 bg-black/20">
                <h3 className="font-heading font-bold text-xl text-foreground truncate">{player2Name}</h3>
                <div className="text-sm font-medium text-primary mt-1">Sets ganados: {p2SetsWon}</div>
              </div>
              <div className="flex-1 flex flex-col items-center justify-center p-6 relative group">
                <span className="text-[12rem] font-black font-heading tabular-nums leading-none text-foreground group-hover:scale-105 transition-transform select-none">
                  {currentP2Score}
                </span>
                {/* Invisible massive button area for tapping on mobile */}
                <button 
                  className="absolute inset-0 z-10 focus:outline-none focus-visible:bg-white/5 active:bg-white/5 transition-colors"
                  onClick={() => handleScore(2, 1)}
                  disabled={matchFinished}
                  aria-label={`Sumar punto a ${player2Name}`}
                />
              </div>
              <div className="p-4 bg-black/20 flex justify-center gap-4 z-20 relative">
                <Button size="lg" variant="destructive" className="h-16 w-20 rounded-2xl" onClick={() => handleScore(2, -1)} disabled={currentP2Score === 0 || matchFinished}>
                  <Minus className="w-8 h-8" />
                </Button>
                <Button size="lg" className="h-16 flex-1 rounded-2xl text-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)]" onClick={() => handleScore(2, 1)} disabled={matchFinished}>
                  <Plus className="w-8 h-8 mr-2" /> 1
                </Button>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-background border-t border-border/50 p-4 flex justify-between items-center gap-4">
            <Button variant="ghost" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
              Salir
            </Button>
            
            {!matchFinished ? (
              <Button size="lg" onClick={finishCurrentSet} className="font-bold px-8 shadow-lg">
                <Square className="w-4 h-4 mr-2" /> Finalizar Set
              </Button>
            ) : (
              <Button size="lg" onClick={() => onFinishMatch(sets, timeSeconds)} className="font-bold px-8 bg-success hover:bg-success/90 text-success-foreground shadow-[0_0_30px_rgba(0,255,0,0.3)] animate-pulse-glow">
                <Trophy className="w-5 h-5 mr-2" /> Subir Resultado Final
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
