// @ts-ignore - Supabase edge functions use Deno, which causes local TS warnings
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
// @ts-ignore
declare const Deno: any;
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token" };

const ADMIN_USERNAME = "leiva leonel";
const ADMIN_PASSWORD = "Leonelsl15";

function respond(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "tdm_siete_palmas_salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function calcRatingChange(r1: number, r2: number, p1Wins: boolean) {
  const diff = Math.abs(r1 - r2);
  let fav: number, upset: number;
  if (diff >= 750) { fav = 1; upset = 28; }
  else if (diff >= 500) { fav = 2; upset = 26; }
  else if (diff >= 400) { fav = 3; upset = 24; }
  else if (diff >= 300) { fav = 4; upset = 22; }
  else if (diff >= 200) { fav = 5; upset = 20; }
  else if (diff >= 150) { fav = 6; upset = 18; }
  else if (diff >= 100) { fav = 7; upset = 16; }
  else if (diff >= 50) { fav = 8; upset = 14; }
  else if (diff >= 25) { fav = 9; upset = 12; }
  else { fav = 10; upset = 10; }
  const winnerHigher = p1Wins ? r1 >= r2 : r2 >= r1;
  const change = winnerHigher ? fav : upset;
  return { change1: p1Wins ? change : -change, change2: p1Wins ? -change : change };
}

// AI Chronicle Generation Helper
async function generateChronicleForMatch(supabase: any, matchId: string, type: "match" | "challenge") {
  try {
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) return;

    let player1Name = "", player2Name = "", winnerName = "";
    let setsStr = "", ratingP1 = 0, ratingP2 = 0;
    let ratingChangeWinner = 0;
    let roundInfo = "", tournamentName = "";
    let wasComeback = false;
    const table = type === "challenge" ? "challenges" : "matches";

    if (type === "challenge") {
      const { data: c } = await supabase.from("challenges").select(`*, challenger:players!challenger_id(full_name, rating), challenged:players!challenged_id(full_name, rating)`).eq("id", matchId).single();
      if (!c) return;
      player1Name = c.challenger.full_name;
      player2Name = c.challenged.full_name;
      ratingP1 = c.challenger.rating;
      ratingP2 = c.challenged.rating;
      const challengerWon = c.winner_id === c.challenger_id;
      winnerName = challengerWon ? player1Name : player2Name;
      ratingChangeWinner = challengerWon ? (c.rating_change_challenger || 0) : (c.rating_change_challenged || 0);
      const scores = (c.set_scores as any[] || []);
      setsStr = scores.map((s: any) => `${s.p1}-${s.p2}`).join(", ");
      if (scores.length >= 2) {
        const firstSetWinner = scores[0].p1 > scores[0].p2 ? c.challenger_id : c.challenged_id;
        if (firstSetWinner !== c.winner_id) wasComeback = true;
      }
      roundInfo = "Desafío directo";
    } else {
      const { data: m } = await supabase.from("matches").select(`*, p1:players!player1_id(full_name, rating), p2:players!player2_id(full_name, rating)`).eq("id", matchId).single();
      if (!m) return;
      player1Name = m.p1.full_name;
      player2Name = m.p2.full_name;
      ratingP1 = m.p1.rating;
      ratingP2 = m.p2.rating;
      const p1Won = m.winner_id === m.player1_id;
      winnerName = p1Won ? player1Name : player2Name;
      ratingChangeWinner = p1Won ? (m.rating_change_p1 || 0) : (m.rating_change_p2 || 0);
      const scores = (m.set_scores as any[] || []);
      setsStr = scores.map((s: any) => `${s.p1}-${s.p2}`).join(", ");
      if (scores.length >= 2) {
        const firstSetWinner = scores[0].p1 > scores[0].p2 ? m.player1_id : m.player2_id;
        if (firstSetWinner !== m.winner_id) wasComeback = true;
      }
      roundInfo = m.round ? `Ronda: ${m.round}` : (m.group_name ? `${m.group_name}` : "");
      if (m.tournament_id) {
        const { data: t } = await supabase.from("tournaments").select("name").eq("id", m.tournament_id).single();
        if (t) tournamentName = t.name;
      }
    }

    const ratingDiff = Math.abs(ratingP1 - ratingP2);
    const isUpset = ratingDiff > 100 && ((ratingP1 > ratingP2 && winnerName !== player1Name) || (ratingP2 > ratingP1 && winnerName !== player2Name));
    const lastSet = setsStr.split(", ").pop() || "";
    const wasClose = lastSet.includes("12-10") || lastSet.includes("11-9") || lastSet.includes("13-11") || lastSet.includes("14-12");

    let extraContext = "";
    if (wasComeback) extraContext += "\n- ¡REMONTADA! El ganador perdió el primer set pero remontó.";
    if (isUpset) extraContext += `\n- ¡SORPRESA! El favorito (con +${ratingDiff} pts de ventaja) fue derrotado.`;
    if (wasClose) extraContext += "\n- El último set fue MUY ajustado, definido en la extensión.";

    const prompt = `Eres un cronista deportivo de tenis de mesa del Club Siete Palmas TDM. Escribí una crónica épica MUY corta (máximo 3 frases) en español argentino informal para este partido:

Jugador A: ${player1Name} (Rating: ${ratingP1})
Jugador B: ${player2Name} (Rating: ${ratingP2})
Resultados de los sets: ${setsStr}
Ganador: ${winnerName}
Cambio de rating del ganador: ${ratingChangeWinner > 0 ? "+" : ""}${ratingChangeWinner}
${roundInfo ? `Contexto: ${roundInfo}` : ""}${tournamentName ? ` del torneo "${tournamentName}"` : ""}
${extraContext}

Reglas:
- Máximo 3 frases cortas y directas
- Usá vocabulario de ping pong: topspin, smash, bloqueo, servicio, defensa, slice, push, loop
- Hacé que suene ÉPICO y emocionante
- Mencioná los nombres de los jugadores (solo apellidos o primer nombre)
- Si hubo remontada, destacala como momento heroico
- Si fue una sorpresa, enfatizá el shock
- NO uses comillas ni formato markdown
- Escribí en español rioplatense`;

    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 250, temperature: 0.9 }
      })
    });

    const aiData = await aiRes.json();
    const chronicle = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (chronicle) {
      await supabase.from(table).update({ ai_chronicle: chronicle }).eq("id", matchId);
    }
    return chronicle || null;
  } catch {
    return null;
  }
}

async function checkAndAwardBadges(supabase: any, playerId: string) {
  const badgeDefs = [
    { name: "Iniciación", icon_url: "🔰", description: "1 partido jugado", type: "automatic" },
    { name: "Bautismo de Fuego", icon_url: "🔥", description: "Primera victoria", type: "automatic" },
    { name: "Competidor", icon_url: "🏅", description: "Primer torneo", type: "automatic" },
    { name: "Tenacidad", icon_url: "🛡️", description: "10 partidos jugados", type: "automatic" },
    { name: "Veterano", icon_url: "🎖️", description: "50 partidos jugados", type: "automatic" },
    { name: "Leyenda Local", icon_url: "👑", description: "100 partidos jugados", type: "automatic" },
    { name: "Racha Imparable", icon_url: "⚡", description: "3 victorias seguidas", type: "automatic" },
    { name: "Invicto", icon_url: "🔱", description: "5 victorias seguidas", type: "automatic" },
    { name: "Guerrero", icon_url: "⚔️", description: "10 victorias totales", type: "automatic" },
    { name: "Maestro", icon_url: "🧠", description: "50 victorias totales", type: "automatic" },
    { name: "Gran Maestro", icon_url: "💎", description: "100 victorias totales", type: "automatic" },
  ];

  // Auto-create missing automatic badges
  for (const b of badgeDefs) {
    const { data } = await supabase.from("badges").select("id").eq("name", b.name).single();
    if (!data) await supabase.from("badges").insert(b);
  }

  const { data: badges } = await supabase.from("badges").select("id, name, type").eq("type", "automatic");
  if (!badges) return;
  const { data: existingBadges } = await supabase.from("player_badges").select("badge_id").eq("player_id", playerId);
  const hasBadge = (name: string) => {
    const badge = badges.find((b: any) => b.name === name);
    return badge && existingBadges?.some((eb: any) => eb.badge_id === badge.id);
  };
  const getBadgeId = (name: string) => badges.find((b: any) => b.name === name)?.id;

  const { count: matchCount } = await supabase.from("matches").select("id", { count: "exact", head: true }).or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
  const { count: challengeMatchCount } = await supabase.from("challenges").select("id", { count: "exact", head: true }).or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`).eq("status", "completed");
  const totalPlayed = (matchCount || 0) + (challengeMatchCount || 0);

  const { count: matchWins } = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("winner_id", playerId);
  const { count: challengeWins } = await supabase.from("challenges").select("id", { count: "exact", head: true }).eq("winner_id", playerId).eq("status", "completed");
  const totalWins = (matchWins || 0) + (challengeWins || 0);

  const { count: tournamentCount } = await supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("player_id", playerId);

  const { data: recentMatches } = await supabase.from("matches").select("winner_id").or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`).order("created_at", { ascending: false }).limit(5);
  const { data: recentChallenges } = await supabase.from("challenges").select("winner_id").or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`).eq("status", "completed").order("created_at", { ascending: false }).limit(5);
  const allRecent = [...(recentMatches || []), ...(recentChallenges || [])].sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  let streak = 0;
  for (const r of allRecent) { if (r.winner_id === playerId) streak++; else break; }

  const toAward: string[] = [];
  const awardIfMissing = (name: string, cond: boolean) => { if (cond && !hasBadge(name)) { const id = getBadgeId(name); if (id) toAward.push(id); } };

  awardIfMissing("Iniciación", totalPlayed >= 1);
  awardIfMissing("Bautismo de Fuego", totalWins >= 1);
  awardIfMissing("Competidor", (tournamentCount || 0) >= 1);
  awardIfMissing("Tenacidad", totalPlayed >= 10);
  awardIfMissing("Veterano", totalPlayed >= 50);
  awardIfMissing("Leyenda Local", totalPlayed >= 100);
  awardIfMissing("Racha Imparable", streak >= 3);
  awardIfMissing("Invicto", streak >= 5);
  awardIfMissing("Guerrero", totalWins >= 10);
  awardIfMissing("Maestro", totalWins >= 50);
  awardIfMissing("Gran Maestro", totalWins >= 100);

  if (toAward.length > 0) {
    await supabase.from("player_badges").insert(toAward.map(badge_id => ({ player_id: playerId, badge_id })));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, ...data } = await req.json();

    if (action === "register") {
      const { full_name, dni, password } = data;
      if (!full_name || !dni || !password) return respond({ error: "Todos los campos son obligatorios" });
      if (full_name.length > 100 || dni.length > 20 || password.length < 6 || password.length > 50)
        return respond({ error: "Datos inválidos. La contraseña debe tener al menos 6 caracteres." });
      const { data: existing } = await supabase.from("players").select("id").or(`full_name.eq.${full_name},dni.eq.${dni}`).limit(1);
      if (existing && existing.length > 0) return respond({ error: "Ya existe un jugador con ese nombre o DNI" });
      const password_hash = await hashPassword(password);
      const { data: player, error } = await supabase.from("players").insert({ full_name: full_name.trim(), dni: dni.trim(), password_hash, rating: 600 }).select("id, full_name, dni, rating, avatar_url").single();
      if (error) return respond({ error: error.message.includes("unique") ? "Ya existe un jugador con ese nombre o DNI" : "Error al registrar" });
      return respond({ player, token: player.id });
    }

    if (action === "login") {
      const { dni, password } = data;
      if (!dni || !password) return respond({ error: "DNI y contraseña son obligatorios" });
      const password_hash = await hashPassword(password);
      const { data: player } = await supabase.from("players").select("id, full_name, dni, rating, avatar_url").eq("dni", dni.trim()).eq("password_hash", password_hash).single();
      if (!player) return respond({ error: "DNI o contraseña incorrectos" });
      return respond({ player, token: player.id });
    }

    if (action === "admin_login") {
      const { username, password } = data;
      if (username?.toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD)
        return respond({ admin: true, token: "admin_token" });
      return respond({ error: "Credenciales de admin incorrectas" });
    }

    if (action === "change_password") {
      const { player_id, current_password, new_password } = data;
      if (!player_id || !current_password || !new_password) return respond({ error: "Todos los campos son obligatorios" });
      if (new_password.length < 6 || new_password.length > 50) return respond({ error: "La nueva contraseña debe tener entre 6 y 50 caracteres" });
      const current_hash = await hashPassword(current_password);
      const { data: player } = await supabase.from("players").select("id").eq("id", player_id).eq("password_hash", current_hash).single();
      if (!player) return respond({ error: "La contraseña actual es incorrecta" });
      const new_hash = await hashPassword(new_password);
      await supabase.from("players").update({ password_hash: new_hash }).eq("id", player_id);
      return respond({ success: true });
    }

    if (action === "update_avatar") {
      const { player_id, avatar_url, player_token } = data;
      if (player_token !== player_id) return respond({ error: "No autorizado" });
      await supabase.from("players").update({ avatar_url }).eq("id", player_id);
      return respond({ success: true });
    }

    if (action === "send_message") {
      const { player_id, content, player_token } = data;
      if (player_token !== player_id) return respond({ error: "No autorizado" });
      if (!content || typeof content !== "string" || content.length > 500) return respond({ error: "Mensaje inválido" });
      const { error } = await supabase.from("messages").insert({ player_id, content });
      if (error) throw error;

      // Auto-delete messages older than 24h
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("messages").delete().lt("created_at", cutoff);

      return respond({ success: true });
    }

    if (action === "create_challenge") {
      const { challenger_id, challenged_id, player_token } = data;
      if (!challenger_id || !challenged_id) return respond({ error: "Jugadores requeridos" });
      if (challenger_id === challenged_id) return respond({ error: "No podés desafiarte a vos mismo" });
      if (player_token !== challenger_id) return respond({ error: "No autorizado" });
      const { data: existing } = await supabase.from("challenges").select("id")
        .or(`and(challenger_id.eq.${challenger_id},challenged_id.eq.${challenged_id}),and(challenger_id.eq.${challenged_id},challenged_id.eq.${challenger_id})`)
        .in("status", ["pending", "accepted"]).limit(1);
      if (existing && existing.length > 0) return respond({ error: "Ya existe un desafío activo entre estos jugadores" });
      const { error } = await supabase.from("challenges").insert({ challenger_id, challenged_id });
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "respond_challenge") {
      const { challenge_id, player_id, accept, player_token } = data;
      if (player_token !== player_id) return respond({ error: "No autorizado" });
      const { data: challenge } = await supabase.from("challenges").select("*").eq("id", challenge_id).eq("challenged_id", player_id).eq("status", "pending").single();
      if (!challenge) return respond({ error: "Desafío no encontrado" });
      await supabase.from("challenges").update({ status: accept ? "accepted" : "rejected" }).eq("id", challenge_id);
      return respond({ success: true });
    }

    if (action === "record_challenge_result") {
      const { challenge_id, set_scores, player_id, player_token } = data;
      if (player_token !== player_id) return respond({ error: "No autorizado" });
      const { data: challenge, error: cErr } = await supabase.from("challenges").select("*").eq("id", challenge_id).eq("status", "accepted").single();
      if (cErr || !challenge) return respond({ error: "Desafío no encontrado o no aceptado" });

      // Todos los jugadores registrados pueden arbitrar y subir resultados de desafíos
      // El chequeo de player_token !== player_id de arriba asegura que estén autenticados.

      let cSetsWon = 0, dSetsWon = 0;
      if (set_scores && Array.isArray(set_scores)) {
        for (const s of set_scores) { if (s.p1 > s.p2) cSetsWon++; else if (s.p2 > s.p1) dSetsWon++; }
      }
      const winner_id = cSetsWon > dSetsWon ? challenge.challenger_id : challenge.challenged_id;

      const { data: players } = await supabase.from("players").select("id, rating").in("id", [challenge.challenger_id, challenge.challenged_id]);
      const p1 = players?.find((p: any) => p.id === challenge.challenger_id);
      const p2 = players?.find((p: any) => p.id === challenge.challenged_id);
      let rc1 = 0, rc2 = 0;
      if (p1 && p2) {
        const { change1, change2 } = calcRatingChange(p1.rating, p2.rating, winner_id === challenge.challenger_id);
        rc1 = change1; rc2 = change2;
        await supabase.from("players").update({ rating: p1.rating + rc1 }).eq("id", challenge.challenger_id);
        await supabase.from("players").update({ rating: p2.rating + rc2 }).eq("id", challenge.challenged_id);
      }

      await supabase.from("challenges").update({
        status: "completed", set_scores, challenger_sets_won: cSetsWon, challenged_sets_won: dSetsWon,
        winner_id, rating_change_challenger: rc1, rating_change_challenged: rc2,
      }).eq("id", challenge_id);

      await checkAndAwardBadges(supabase, challenge.challenger_id);
      await checkAndAwardBadges(supabase, challenge.challenged_id);

      // Auto-generate AI chronicle (fire-and-forget)
      generateChronicleForMatch(supabase, challenge_id, "challenge").catch(() => { });

      return respond({ success: true });
    }

    if (action === "update_attributes") {
      const { player_id, player_token, attributes } = data;
      if (player_token !== player_id) return respond({ error: "No autorizado" });
      if (!attributes || typeof attributes !== "object") return respond({ error: "Atributos inválidos" });
      // Validate each attribute is between 0 and 100
      const keys = ["attack", "defense", "serve", "control", "speed", "mental"];
      for (const k of keys) {
        if (attributes[k] == null || attributes[k] < 0 || attributes[k] > 100) {
          return respond({ error: `Atributo ${k} debe estar entre 0 y 100` });
        }
      }
      const { error } = await supabase.from("players").update({ attributes }).eq("id", player_id);
      if (error) throw error;
      return respond({ success: true });
    }

    return respond({ error: "Acción no válida" });
  } catch (e) {
    return respond({ error: "Error interno del servidor" });
  }
});
