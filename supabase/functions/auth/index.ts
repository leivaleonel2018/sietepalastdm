import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
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

async function checkAndAwardBadges(supabase: any, playerId: string) {
  const { data: badges } = await supabase.from("badges").select("id, name, type").eq("type", "automatic");
  if (!badges) return;

  const { data: existingBadges } = await supabase.from("player_badges").select("badge_id").eq("player_id", playerId);
  const hasBadge = (name: string) => {
    const badge = badges.find((b: any) => b.name === name);
    return badge && existingBadges?.some((eb: any) => eb.badge_id === badge.id);
  };
  const getBadgeId = (name: string) => badges.find((b: any) => b.name === name)?.id;

  // Count matches and wins
  const { count: matchCount } = await supabase.from("matches").select("id", { count: "exact", head: true })
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
  const { count: challengeMatchCount } = await supabase.from("challenges").select("id", { count: "exact", head: true })
    .or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`).eq("status", "completed");
  const totalPlayed = (matchCount || 0) + (challengeMatchCount || 0);

  const { count: matchWins } = await supabase.from("matches").select("id", { count: "exact", head: true }).eq("winner_id", playerId);
  const { count: challengeWins } = await supabase.from("challenges").select("id", { count: "exact", head: true }).eq("winner_id", playerId).eq("status", "completed");
  const totalWins = (matchWins || 0) + (challengeWins || 0);

  const { count: tournamentCount } = await supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("player_id", playerId);

  const toAward: string[] = [];

  if (totalPlayed >= 1 && !hasBadge("Primer partido")) { const id = getBadgeId("Primer partido"); if (id) toAward.push(id); }
  if (totalWins >= 1 && !hasBadge("Primera victoria")) { const id = getBadgeId("Primera victoria"); if (id) toAward.push(id); }
  if ((tournamentCount || 0) >= 1 && !hasBadge("Primer torneo")) { const id = getBadgeId("Primer torneo"); if (id) toAward.push(id); }
  if (totalWins >= 10 && !hasBadge("10 victorias")) { const id = getBadgeId("10 victorias"); if (id) toAward.push(id); }

  // Check streaks - get last N matches ordered by date
  const { data: recentMatches } = await supabase.from("matches").select("winner_id").or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`).order("created_at", { ascending: false }).limit(5);
  const { data: recentChallenges } = await supabase.from("challenges").select("winner_id").or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`).eq("status", "completed").order("created_at", { ascending: false }).limit(5);

  const allRecent = [...(recentMatches || []), ...(recentChallenges || [])];
  let streak = 0;
  for (const r of allRecent) { if (r.winner_id === playerId) streak++; else break; }

  if (streak >= 3 && !hasBadge("Racha x3")) { const id = getBadgeId("Racha x3"); if (id) toAward.push(id); }
  if (streak >= 5 && !hasBadge("Racha x5")) { const id = getBadgeId("Racha x5"); if (id) toAward.push(id); }

  if (toAward.length > 0) {
    await supabase.from("player_badges").insert(
      toAward.map(badge_id => ({ player_id: playerId, badge_id }))
    );
  }
}

Deno.serve(async (req) => {
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

      // Allow participants OR designated registrars to record results
      const isParticipant = challenge.challenger_id === player_id || challenge.challenged_id === player_id;
      let isRegistrar = false;
      if (!isParticipant) {
        const { data: pData } = await supabase.from("players").select("full_name").eq("id", player_id).single();
        const registrarNames = ["hernán ariel duarte", "leonel samuel leiva", "gonzalez octavio"];
        isRegistrar = pData ? registrarNames.includes(pData.full_name.toLowerCase()) : false;
      }
      if (!isParticipant && !isRegistrar) return respond({ error: "No tenés permiso para registrar este resultado" });

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

      // Check badges for both players
      await checkAndAwardBadges(supabase, challenge.challenger_id);
      await checkAndAwardBadges(supabase, challenge.challenged_id);

      return respond({ success: true });
    }

    return respond({ error: "Acción no válida" });
  } catch (e) {
    return respond({ error: "Error interno del servidor" });
  }
});
