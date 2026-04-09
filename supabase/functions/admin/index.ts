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
  const auth = req.headers.get("x-admin-token");
  return auth === ADMIN_TOKEN;
}

function calcRatingChange(r1: number, r2: number, p1Wins: boolean): { change1: number; change2: number } {
  const diff = Math.abs(r1 - r2);
  let favoredWinChange: number;
  let upsetWinChange: number;

  if (diff >= 750) { favoredWinChange = 1; upsetWinChange = 28; }
  else if (diff >= 500) { favoredWinChange = 2; upsetWinChange = 26; }
  else if (diff >= 400) { favoredWinChange = 3; upsetWinChange = 24; }
  else if (diff >= 300) { favoredWinChange = 4; upsetWinChange = 22; }
  else if (diff >= 200) { favoredWinChange = 5; upsetWinChange = 20; }
  else if (diff >= 150) { favoredWinChange = 6; upsetWinChange = 18; }
  else if (diff >= 100) { favoredWinChange = 7; upsetWinChange = 16; }
  else if (diff >= 50) { favoredWinChange = 8; upsetWinChange = 14; }
  else if (diff >= 25) { favoredWinChange = 9; upsetWinChange = 12; }
  else { favoredWinChange = 10; upsetWinChange = 10; }

  const winnerHigher = p1Wins ? r1 >= r2 : r2 >= r1;
  const change = winnerHigher ? favoredWinChange : upsetWinChange;

  return {
    change1: p1Wins ? change : -change,
    change2: p1Wins ? -change : change,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!checkAdmin(req)) {
    return respond({ error: "No autorizado" }, 401);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...data } = await req.json();

    if (action === "create_tournament") {
      const { name, description, format, type, max_players, groups_count } = data;
      if (!name || !format || !type) return respond({ error: "Nombre, formato y tipo son obligatorios" });
      const { data: tournament, error } = await supabase
        .from("tournaments")
        .insert({ name, description, format, type, max_players, groups_count })
        .select()
        .single();
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
      const { error } = await supabase.from("tournaments").delete().eq("id", tournament_id);
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "record_match") {
      const { tournament_id, player1_id, player2_id, set_scores, round, group_name, match_order } = data;

      // Calculate sets won from set_scores
      let player1_score = 0;
      let player2_score = 0;
      if (set_scores && Array.isArray(set_scores)) {
        for (const s of set_scores) {
          if (s.p1 > s.p2) player1_score++;
          else if (s.p2 > s.p1) player2_score++;
        }
      }

      const winner_id = player1_score > player2_score ? player1_id : player2_id;

      const { data: players } = await supabase
        .from("players")
        .select("id, rating")
        .in("id", [player1_id, player2_id]);

      const p1 = players?.find((p: any) => p.id === player1_id);
      const p2 = players?.find((p: any) => p.id === player2_id);

      let rating_change_p1 = 0;
      let rating_change_p2 = 0;

      if (p1 && p2) {
        const { change1, change2 } = calcRatingChange(p1.rating, p2.rating, winner_id === player1_id);
        rating_change_p1 = change1;
        rating_change_p2 = change2;
        await supabase.from("players").update({ rating: p1.rating + rating_change_p1 }).eq("id", player1_id);
        await supabase.from("players").update({ rating: p2.rating + rating_change_p2 }).eq("id", player2_id);
      }

      const { data: match, error } = await supabase
        .from("matches")
        .insert({
          tournament_id, player1_id, player2_id, player1_score, player2_score,
          winner_id, round, group_name, match_order,
          rating_change_p1, rating_change_p2, set_scores
        })
        .select()
        .single();

      if (error) throw error;
      return respond({ match });
    }

    if (action === "record_challenge_result") {
      const { challenge_id, set_scores } = data;

      // Get challenge
      const { data: challenge, error: cErr } = await supabase
        .from("challenges")
        .select("*")
        .eq("id", challenge_id)
        .eq("status", "accepted")
        .single();

      if (cErr || !challenge) return respond({ error: "Desafío no encontrado o no aceptado" });

      let challenger_sets_won = 0;
      let challenged_sets_won = 0;
      if (set_scores && Array.isArray(set_scores)) {
        for (const s of set_scores) {
          if (s.p1 > s.p2) challenger_sets_won++;
          else if (s.p2 > s.p1) challenged_sets_won++;
        }
      }

      const winner_id = challenger_sets_won > challenged_sets_won ? challenge.challenger_id : challenge.challenged_id;

      const { data: players } = await supabase
        .from("players")
        .select("id, rating")
        .in("id", [challenge.challenger_id, challenge.challenged_id]);

      const p1 = players?.find((p: any) => p.id === challenge.challenger_id);
      const p2 = players?.find((p: any) => p.id === challenge.challenged_id);

      let rating_change_challenger = 0;
      let rating_change_challenged = 0;

      if (p1 && p2) {
        const { change1, change2 } = calcRatingChange(p1.rating, p2.rating, winner_id === challenge.challenger_id);
        rating_change_challenger = change1;
        rating_change_challenged = change2;
        await supabase.from("players").update({ rating: p1.rating + rating_change_challenger }).eq("id", challenge.challenger_id);
        await supabase.from("players").update({ rating: p2.rating + rating_change_challenged }).eq("id", challenge.challenged_id);
      }

      const { error } = await supabase
        .from("challenges")
        .update({
          status: "completed",
          set_scores,
          challenger_sets_won,
          challenged_sets_won,
          winner_id,
          rating_change_challenger,
          rating_change_challenged,
        })
        .eq("id", challenge_id);

      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "add_placement_points") {
      const { player_id, placement } = data;
      const placementPoints: Record<string, number> = {
        "campeon": 30, "subcampeon": 25, "tercero": 21,
        "4to": 17, "8vo": 13, "16vo": 10, "32vo": 8,
        "64vo": 6, "128vo": 4, "grupo_perdido": -2
      };
      const points = placementPoints[placement] || 0;
      const { data: player } = await supabase.from("players").select("rating").eq("id", player_id).single();
      if (player) {
        await supabase.from("players").update({ rating: player.rating + points }).eq("id", player_id);
      }
      return respond({ success: true, points });
    }

    if (action === "register_player_tournament") {
      const { tournament_id, player_id } = data;
      const { error } = await supabase.from("tournament_registrations").insert({ tournament_id, player_id });
      if (error) {
        const msg = error.message.includes("unique") ? "El jugador ya está inscrito" : error.message;
        return respond({ error: msg });
      }
      return respond({ success: true });
    }

    if (action === "generate_bracket") {
      const { tournament_id } = data;
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select("player_id, players(id, full_name, rating)")
        .eq("tournament_id", tournament_id);

      if (!regs || regs.length < 2) return respond({ error: "Se necesitan al menos 2 jugadores" });

      const sortedPlayers = regs.map((r: any) => r.players).filter(Boolean).sort((a: any, b: any) => b.rating - a.rating);
      const n = sortedPlayers.length;
      let bracketSize = 1;
      while (bracketSize < n) bracketSize *= 2;

      const seeded: (any | null)[] = new Array(bracketSize).fill(null);
      for (let i = 0; i < n; i++) seeded[i] = sortedPlayers[i];

      const roundNames: Record<number, string> = { 2: "Final", 4: "Semifinal", 8: "Cuartos", 16: "Octavos", 32: "16vos", 64: "32vos", 128: "64vos", 256: "128vos" };
      const roundName = roundNames[bracketSize] || `Ronda de ${bracketSize}`;
      const firstRoundMatches = [];

      for (let i = 0; i < bracketSize / 2; i++) {
        const p1 = seeded[i];
        const p2 = seeded[bracketSize - 1 - i];
        if (p1 || p2) {
          firstRoundMatches.push({
            tournament_id, player1_id: p1?.id || null, player2_id: p2?.id || null,
            round: roundName, match_order: i + 1,
            ...(p1 && !p2 ? { winner_id: p1.id, player1_score: 3, player2_score: 0 } : {}),
            ...(!p1 && p2 ? { winner_id: p2.id, player1_score: 0, player2_score: 3 } : {}),
          });
        }
      }

      if (firstRoundMatches.length > 0) {
        const { error } = await supabase.from("matches").insert(firstRoundMatches);
        if (error) throw error;
      }
      await supabase.from("tournaments").update({ status: "in_progress" }).eq("id", tournament_id);
      return respond({ success: true, matches_created: firstRoundMatches.length });
    }

    return respond({ error: "Acción no válida" });
  } catch (e) {
    return respond({ error: "Error interno del servidor" }, 500);
  }
});
