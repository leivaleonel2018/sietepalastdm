import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token" };

const ADMIN_TOKEN = "admin_token";

function respond(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function checkAdmin(req: Request): boolean {
  return req.headers.get("x-admin-token") === ADMIN_TOKEN;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!checkAdmin(req)) return respond({ error: "No autorizado" }, 401);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, ...data } = await req.json();

    if (action === "create_tournament") {
      const { name, description, format, type, max_players, groups_count } = data;
      if (!name || !format || !type) return respond({ error: "Nombre, formato y tipo son obligatorios" });
      const { data: tournament, error } = await supabase.from("tournaments").insert({ name, description, format, type, max_players, groups_count }).select().single();
      if (error) throw error;
      return respond({ tournament });
    }

    if (action === "update_tournament_status") {
      const { tournament_id, status } = data;
      const { error } = await supabase.from("tournaments").update({ status }).eq("id", tournament_id);
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "delete_tournament") {
      const { tournament_id } = data;
      await supabase.from("matches").delete().eq("tournament_id", tournament_id);
      await supabase.from("tournament_registrations").delete().eq("tournament_id", tournament_id);
      const { error } = await supabase.from("tournaments").delete().eq("id", tournament_id);
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "record_match") {
      const { tournament_id, player1_id, player2_id, set_scores, round, group_name, match_order, existing_match_id } = data;

      let p1Score = 0, p2Score = 0;
      if (set_scores && Array.isArray(set_scores)) {
        for (const s of set_scores) { if (s.p1 > s.p2) p1Score++; else if (s.p2 > s.p1) p2Score++; }
      }
      const winner_id = p1Score > p2Score ? player1_id : player2_id;

      const { data: players } = await supabase.from("players").select("id, rating").in("id", [player1_id, player2_id]);
      const p1 = players?.find((p: any) => p.id === player1_id);
      const p2 = players?.find((p: any) => p.id === player2_id);
      let rc1 = 0, rc2 = 0;
      if (p1 && p2) {
        const { change1, change2 } = calcRatingChange(p1.rating, p2.rating, winner_id === player1_id);
        rc1 = change1; rc2 = change2;
        await supabase.from("players").update({ rating: p1.rating + rc1 }).eq("id", player1_id);
        await supabase.from("players").update({ rating: p2.rating + rc2 }).eq("id", player2_id);
      }

      if (existing_match_id) {
        const { error } = await supabase.from("matches").update({
          player1_score: p1Score, player2_score: p2Score, winner_id,
          rating_change_p1: rc1, rating_change_p2: rc2, set_scores
        }).eq("id", existing_match_id);
        if (error) throw error;
        return respond({ success: true });
      }

      const { data: match, error } = await supabase.from("matches").insert({
        tournament_id, player1_id, player2_id, player1_score: p1Score, player2_score: p2Score,
        winner_id, round, group_name, match_order, rating_change_p1: rc1, rating_change_p2: rc2, set_scores
      }).select().single();
      if (error) throw error;
      return respond({ match });
    }

    if (action === "record_challenge_result") {
      const { challenge_id, set_scores } = data;
      const { data: challenge, error: cErr } = await supabase.from("challenges").select("*").eq("id", challenge_id).eq("status", "accepted").single();
      if (cErr || !challenge) return respond({ error: "Desafío no encontrado o no aceptado" });

      let cSetsWon = 0, dSetsWon = 0;
      if (set_scores && Array.isArray(set_scores)) {
        for (const s of set_scores) { if (s.p1 > s.p2) cSetsWon++; else if (s.p2 > s.p1) dSetsWon++; }
      }
      const winner_id = cSetsWon > dSetsWon ? challenge.challenger_id : challenge.challenged_id;

      const { data: players } = await supabase.from("players").select("id, rating").in("id", [challenge.challenger_id, challenge.challenged_id]);
      const p1 = players?.find((p: any) => p.id === challenge.challenger_id);
      const p2 = players?.find((p: any) => p.id === challenge.challenged_id);
      let rcChallenger = 0, rcChallenged = 0;
      if (p1 && p2) {
        const { change1, change2 } = calcRatingChange(p1.rating, p2.rating, winner_id === challenge.challenger_id);
        rcChallenger = change1; rcChallenged = change2;
        await supabase.from("players").update({ rating: p1.rating + rcChallenger }).eq("id", challenge.challenger_id);
        await supabase.from("players").update({ rating: p2.rating + rcChallenged }).eq("id", challenge.challenged_id);
      }

      const { error } = await supabase.from("challenges").update({
        status: "completed", set_scores, challenger_sets_won: cSetsWon, challenged_sets_won: dSetsWon,
        winner_id, rating_change_challenger: rcChallenger, rating_change_challenged: rcChallenged,
      }).eq("id", challenge_id);
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "add_placement_points") {
      const { player_id, placement } = data;
      const pts: Record<string, number> = { campeon: 30, subcampeon: 25, tercero: 21, "4to": 17, "8vo": 13, "16vo": 10, "32vo": 8, "64vo": 6, "128vo": 4, grupo_perdido: -2 };
      const points = pts[placement] || 0;
      const { data: player } = await supabase.from("players").select("rating").eq("id", player_id).single();
      if (player) await supabase.from("players").update({ rating: player.rating + points }).eq("id", player_id);
      return respond({ success: true, points });
    }

    if (action === "register_player_tournament") {
      const { tournament_id, player_id } = data;
      const { error } = await supabase.from("tournament_registrations").insert({ tournament_id, player_id });
      if (error) return respond({ error: error.message.includes("unique") ? "Ya inscripto" : error.message });
      return respond({ success: true });
    }

    if (action === "generate_bracket") {
      const { tournament_id } = data;
      const { data: regs } = await supabase.from("tournament_registrations").select("player_id, players(id, full_name, rating)").eq("tournament_id", tournament_id);
      if (!regs || regs.length < 2) return respond({ error: "Se necesitan al menos 2 jugadores" });

      const sorted = regs.map((r: any) => r.players).filter(Boolean).sort((a: any, b: any) => b.rating - a.rating);
      const n = sorted.length;
      let sz = 1;
      while (sz < n) sz *= 2;

      const seeded: (any | null)[] = new Array(sz).fill(null);
      for (let i = 0; i < n; i++) seeded[i] = sorted[i];

      const rn: Record<number, string> = { 2: "Final", 4: "Semifinal", 8: "Cuartos", 16: "Octavos", 32: "16vos", 64: "32vos" };
      const roundName = rn[sz] || `Ronda de ${sz}`;
      const matches: any[] = [];

      for (let i = 0; i < sz / 2; i++) {
        const p1 = seeded[i], p2 = seeded[sz - 1 - i];
        if (p1 || p2) {
          matches.push({
            tournament_id, player1_id: p1?.id || null, player2_id: p2?.id || null,
            round: roundName, match_order: i + 1,
            ...(p1 && !p2 ? { winner_id: p1.id, player1_score: 2, player2_score: 0 } : {}),
            ...(!p1 && p2 ? { winner_id: p2.id, player1_score: 0, player2_score: 2 } : {}),
          });
        }
      }

      if (matches.length > 0) {
        const { error } = await supabase.from("matches").insert(matches);
        if (error) throw error;
      }
      await supabase.from("tournaments").update({ status: "in_progress" }).eq("id", tournament_id);
      return respond({ success: true, matches_created: matches.length });
    }

    if (action === "advance_phase") {
      const { tournament_id } = data;
      const { data: currentMatches } = await supabase.from("matches").select("*").eq("tournament_id", tournament_id).order("match_order");
      if (!currentMatches) return respond({ error: "Sin partidos" });

      // Get matches without a group (elimination matches)
      const elimMatches = currentMatches.filter((m: any) => !m.group_name);
      const unfinished = elimMatches.filter((m: any) => !m.winner_id);
      if (unfinished.length > 0) return respond({ error: "Hay partidos sin resultado en la ronda actual" });

      // Get latest round
      const rounds = [...new Set(elimMatches.map((m: any) => m.round))];
      const latestRound = rounds[rounds.length - 1];
      const latestMatches = elimMatches.filter((m: any) => m.round === latestRound);
      
      if (latestMatches.length <= 1) return respond({ error: "El torneo ya terminó" });

      const winners = latestMatches.map((m: any) => m.winner_id).filter(Boolean);
      const rn: Record<number, string> = { 1: "Final", 2: "Final", 4: "Semifinal", 8: "Cuartos", 16: "Octavos" };
      const nextRoundName = rn[winners.length] || `Ronda de ${winners.length}`;

      const nextMatches: any[] = [];
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          nextMatches.push({
            tournament_id, player1_id: winners[i], player2_id: winners[i + 1],
            round: nextRoundName, match_order: Math.floor(i / 2) + 1,
          });
        } else {
          // Odd number - bye
          nextMatches.push({
            tournament_id, player1_id: winners[i], player2_id: null,
            round: nextRoundName, match_order: Math.floor(i / 2) + 1,
            winner_id: winners[i], player1_score: 2, player2_score: 0,
          });
        }
      }

      if (nextMatches.length > 0) {
        const { error } = await supabase.from("matches").insert(nextMatches);
        if (error) throw error;
      }

      // If it was the final, finish tournament
      if (nextMatches.length === 1 && nextRoundName === "Final") {
        // Tournament will finish when the final result is recorded
      }

      return respond({ success: true, message: `${nextMatches.length} partidos generados para ${nextRoundName}` });
    }

    if (action === "create_news") {
      const { title, content, image_url } = data;
      if (!title || !content) return respond({ error: "Título y contenido requeridos" });
      const { error } = await supabase.from("news").insert({ title, content, image_url });
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "delete_news") {
      const { news_id } = data;
      const { error } = await supabase.from("news").delete().eq("id", news_id);
      if (error) throw error;
      return respond({ success: true });
    }

    return respond({ error: "Acción no válida" });
  } catch (e) {
    return respond({ error: "Error interno del servidor" }, 500);
  }
});
