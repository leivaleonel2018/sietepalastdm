import { useState } from "react";
import { Sparkles, RefreshCw, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAction } from "@/lib/api";
import { toast } from "sonner";

interface MatchChronicleProps {
  chronicle: string | null;
  matchId: string;
  type: "match" | "challenge";
  isAdmin: boolean;
  adminToken: string;
  onRegenerated?: () => void;
  compact?: boolean;
}

export function MatchChronicle({
  chronicle,
  matchId,
  type,
  isAdmin,
  adminToken,
  onRegenerated,
  compact = false,
}: MatchChronicleProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localChronicle, setLocalChronicle] = useState<string | null>(chronicle);
  const [isExpanded, setIsExpanded] = useState(false);

  const generateChronicle = async () => {
    if (!isAdmin || !adminToken) return;
    setIsGenerating(true);
    toast.info("✍️ Generando crónica con IA...");
    try {
      const result = await adminAction(
        "generate_match_chronicle",
        { match_id: matchId, type },
        adminToken
      );
      if (result.error) {
        toast.error(result.error);
      } else {
        setLocalChronicle(result.chronicle);
        toast.success("¡Crónica generada!");
        onRegenerated?.();
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const displayChronicle = localChronicle || chronicle;

  if (displayChronicle) {
    return (
      <div
        className={`relative overflow-hidden transition-all duration-500 ${
          compact ? "mt-2" : "mt-3"
        }`}
      >
        <div
          className={`
            relative p-3 rounded-xl border transition-all duration-300 cursor-pointer
            bg-gradient-to-br from-primary/5 via-transparent to-accent/5
            border-primary/10 hover:border-primary/20
            hover:shadow-[0_0_20px_rgba(var(--primary-rgb,139,92,246),0.08)]
            group/chronicle
          `}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Sparkle decorations */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary/30 group-hover/chronicle:text-primary/50 transition-colors" />
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  generateChronicle();
                }}
                className="p-1 rounded-md hover:bg-primary/10 text-primary/30 hover:text-primary transition-all opacity-0 group-hover/chronicle:opacity-100"
                title="Regenerar crónica"
              >
                <RefreshCw className={`w-3 h-3 ${isGenerating ? "animate-spin" : ""}`} />
              </button>
            )}
          </div>

          {/* Animated gradient line */}
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary/40 via-accent/30 to-primary/10 rounded-l-xl" />

          <div className="flex items-start gap-2 pl-2">
            <BookOpen className="w-3.5 h-3.5 text-primary/40 mt-0.5 flex-shrink-0" />
            <p
              className={`text-xs text-foreground/75 italic leading-relaxed pr-6 transition-all duration-300 ${
                !isExpanded && compact ? "line-clamp-2" : ""
              }`}
            >
              {displayChronicle}
            </p>
          </div>

          {/* "Crónica IA" micro-badge */}
          <div className="flex items-center gap-1.5 mt-2 pl-2">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-primary/30 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              Crónica IA
            </span>
          </div>
        </div>
      </div>
    );
  }

  // No chronicle yet — show generate button for admins
  if (isAdmin) {
    return (
      <div className={`${compact ? "mt-2" : "mt-3"} flex justify-end`}>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] gap-1.5 hover:bg-primary/10 hover:text-primary transition-all opacity-60 hover:opacity-100"
          onClick={generateChronicle}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {isGenerating ? "Generando..." : "Generar Crónica con IA"}
        </Button>
      </div>
    );
  }

  return null;
}
