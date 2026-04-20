import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { authAction } from "@/lib/api";
import { MessageCircle, X, Send } from "lucide-react";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  player_id: string;
  content: string;
  created_at: string;
}

interface PlayerInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Badge {
  name: string;
  icon_url: string | null;
  type: string;
}

export default function GlobalChat() {
  const { player, playerToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, PlayerInfo>>({});
  const [playerBadges, setPlayerBadges] = useState<Record<string, Badge[]>>({});
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(100);
    const msgs = (data || []) as ChatMessage[];
    setMessages(msgs);

    // Build players map
    const pids = new Set<string>();
    msgs.forEach(m => pids.add(m.player_id));
    if (pids.size > 0) {
      const { data: pData } = await supabase.from("players").select("id, full_name, avatar_url").in("id", Array.from(pids));
      const map: Record<string, PlayerInfo> = {};
      (pData || []).forEach((p: any) => { map[p.id] = p; });
      setPlayersMap(map);

      // Fetch badges for these players (last 3 per player)
      const { data: pbData } = await supabase
        .from("player_badges")
        .select("player_id, badges(name, icon_url, type)")
        .in("player_id", Array.from(pids))
        .order("created_at", { ascending: false });
      const bMap: Record<string, Badge[]> = {};
      (pbData || []).forEach((pb: any) => {
        if (!pb.badges) return;
        if (!bMap[pb.player_id]) bMap[pb.player_id] = [];
        if (bMap[pb.player_id].length < 3) {
          bMap[pb.player_id].push(pb.badges);
        }
      });
      setPlayerBadges(bMap);
    }

    if (!open && msgs.length > 0) {
      const lastSeen = lastSeenRef.current;
      if (lastSeen) {
        const newCount = msgs.filter(m => m.created_at > lastSeen).length;
        setUnread(newCount);
      }
    }
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel("global-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        fetchMessages();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (messages.length > 0) {
        lastSeenRef.current = messages[messages.length - 1].created_at;
        setUnread(0);
      }
    }
  }, [open, messages]);

  const sendMessage = async () => {
    if (!player || !content.trim() || sending) return;
    setSending(true);
    const result = await authAction("send_message", {
      player_id: player.id,
      content: content.trim(),
      player_token: playerToken,
    });
    setSending(false);
    if (result.error) { toast.error(result.error); return; }
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-24 right-6 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Overlay to close menu */}
      {open && (
        <div 
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-300"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 md:bottom-24 md:right-6 z-50 w-[calc(100%-3rem)] md:w-96 h-[28rem] glass-card flex flex-col shadow-2xl animate-slide-up overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-sm text-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" /> Chat Global
            </h3>
            <span className="text-xs text-muted-foreground">{messages.length} mensajes</span>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center mt-8">Sin mensajes aún. ¡Sé el primero!</p>
            ) : (
              messages.map(m => {
                const p = playersMap[m.player_id];
                const isMe = m.player_id === player?.id;
                const badges = playerBadges[m.player_id] || [];
                return (
                  <div key={m.id} className={`flex gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary overflow-hidden flex-shrink-0">
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        p?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?"
                      )}
                    </div>
                    <div className={`max-w-[75%] ${isMe ? "text-right" : ""}`}>
                      <div className={`flex items-center gap-1 mb-0.5 ${isMe ? "justify-end" : ""}`}>
                        <span className="text-[10px] font-medium text-muted-foreground">{p?.full_name || "?"}</span>
                        {badges.map((b, i) => (
                          <span key={i} className="text-[10px] cursor-help" title={b.name}>
                            {b.icon_url && b.icon_url.length <= 4 ? b.icon_url : "🏅"}
                          </span>
                        ))}
                      </div>
                      <div className={`inline-block px-3 py-1.5 rounded-xl text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                        {m.content}
                      </div>
                      <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                        {new Date(m.created_at).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {player ? (
            <div className="px-3 py-2 border-t border-border bg-card">
              <div className="flex gap-2">
                <input
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribí un mensaje..."
                  maxLength={500}
                  className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                />
                <button
                  onClick={sendMessage}
                  disabled={!content.trim() || sending}
                  className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="px-3 py-3 border-t border-border bg-card text-center">
              <p className="text-xs text-muted-foreground">Iniciá sesión para chatear</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
