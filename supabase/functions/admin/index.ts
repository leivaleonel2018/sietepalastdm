import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token" };

const ADMIN_TOKEN = "admin_token";

function checkAdmin(req: Request): boolean {
  const auth = req.headers.get("x-admin-token");
  return auth === ADMIN_TOKEN;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!checkAdmin(req)) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...data } = await req.json();

    if (action === "create_tournament") {
      const { name, description, format, type, max_players, groups_count } = data;
      if (!name || !format || !type) {
        return new Response(
          JSON.stringify({ error: "Nombre, formato y tipo son obligatorios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const { data: tournament, error } = await supabase
        .from("tournaments")
        .insert({ name, description, format, type, max_players, groups_count })
        .select()
        .single();
      if (error) throw error;
      return new Response(
        JSON.stringify({ tournament }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_tournament_status") {
      const { tournament_id, status } = data;
      const { error } = await supabase
        .from("tournaments")
        .update({ status })
        .eq("id", tournament_id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete_tournament") {
      const { tournament_id } = data;
      const { error } = await supabase
        .from("tournaments")
        .delete()
        .eq("id", tournament_id);
      if (error) throw error;
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "record_match") {
      const { tournament_id, player1_id, player2_id, player1_score, player2_score, round, group_name, match_order } = data;
      
      const winner_id = player1_score > player2_score ? player1_id : player2_id;
      
      // Get players' ratings
      const { data: players } = await supabase
        .from("players")
        .select("id, rating")
        .in("id", [player1_id, player2_id]);
      
      const p1 = players?.find(p => p.id === player1_id);
      const p2 = players?.find(p => p.id === player2_id);
      
      let rating_change_p1 = 0;
      let rating_change_p2 = 0;
      
      if (p1 && p2) {
        const diff = Math.abs(p1.rating - p2.rating);
        let change: number;
        
        if (diff >= 750) change = p1.rating > p2.rating ? 1 : 28;
        else if (diff >= 500) change = p1.rating > p2.rating ? 2 : 26;
        else if (diff >= 400) change = p1.rating > p2.rating ? 3 : 24;
        else if (diff >= 300) change = p1.rating > p2.rating ? 4 : 22;
        else if (diff >= 200) change = p1.rating > p2.rating ? 5 : 20;
        else if (diff >= 150) change = p1.rating > p2.rating ? 6 : 18;
        else if (diff >= 100) change = p1.rating > p2.rating ? 7 : 16;
        else if (diff >= 50) change = p1.rating > p2.rating ? 8 : 14;
        else if (diff >= 25) change = p1.rating > p2.rating ? 9 : 12;
        else change = 10;

        if (winner_id === player1_id) {
          // If higher rated wins
          if (p1.rating >= p2.rating) {
            rating_change_p1 = change;
            rating_change_p2 = -change;
          } else {
            // Lower rated wins (upset) - use the higher value
            const upsetChange = diff >= 750 ? 28 : diff >= 500 ? 26 : diff >= 400 ? 24 : diff >= 300 ? 22 : diff >= 200 ? 20 : diff >= 150 ? 18 : diff >= 100 ? 16 : diff >= 50 ? 14 : diff >= 25 ? 12 : 10;
            rating_change_p1 = upsetChange;
            rating_change_p2 = -upsetChange;
          }
        } else {
          if (p2.rating >= p1.rating) {
            rating_change_p2 = change;
            rating_change_p1 = -change;
          } else {
            const upsetChange = diff >= 750 ? 28 : diff >= 500 ? 26 : diff >= 400 ? 24 : diff >= 300 ? 22 : diff >= 200 ? 20 : diff >= 150 ? 18 : diff >= 100 ? 16 : diff >= 50 ? 14 : diff >= 25 ? 12 : 10;
            rating_change_p2 = upsetChange;
            rating_change_p1 = -upsetChange;
          }
        }

        // Update ratings
        await supabase.from("players").update({ rating: p1.rating + rating_change_p1 }).eq("id", player1_id);
        await supabase.from("players").update({ rating: p2.rating + rating_change_p2 }).eq("id", player2_id);
      }

      const { data: match, error } = await supabase
        .from("matches")
        .insert({
          tournament_id, player1_id, player2_id, player1_score, player2_score,
          winner_id, round, group_name, match_order,
          rating_change_p1, rating_change_p2
        })
        .select()
        .single();
      
      if (error) throw error;
      return new Response(
        JSON.stringify({ match }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add_placement_points") {
      const { player_id, placement } = data;
      const placementPoints: Record<string, number> = {
        "campeon": 30, "subcampeon": 25, "tercero": 21,
        "4to": 17, "8vo": 13, "16vo": 10, "32vo": 8,
        "64vo": 6, "128vo": 4, "grupo_perdido": -2
      };
      const points = placementPoints[placement] || 0;
      const { data: player } = await supabase
        .from("players")
        .select("rating")
        .eq("id", player_id)
        .single();
      if (player) {
        await supabase.from("players").update({ rating: player.rating + points }).eq("id", player_id);
      }
      return new Response(
        JSON.stringify({ success: true, points }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "register_player_tournament") {
      const { tournament_id, player_id } = data;
      const { error } = await supabase
        .from("tournament_registrations")
        .insert({ tournament_id, player_id });
      if (error) {
        const msg = error.message.includes("unique") ? "El jugador ya está inscrito" : error.message;
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "generate_bracket") {
      const { tournament_id } = data;
      
      // Get registered players with ratings
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select("player_id, players(id, full_name, rating)")
        .eq("tournament_id", tournament_id);
      
      if (!regs || regs.length < 2) {
        return new Response(
          JSON.stringify({ error: "Se necesitan al menos 2 jugadores" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Sort by rating descending for seeding
      const sortedPlayers = regs
        .map((r: any) => r.players)
        .filter(Boolean)
        .sort((a: any, b: any) => b.rating - a.rating);

      // Pad to next power of 2
      const n = sortedPlayers.length;
      let bracketSize = 1;
      while (bracketSize < n) bracketSize *= 2;

      // Create seeded bracket (1v last, 2v second-to-last, etc.)
      const seeded: (any | null)[] = new Array(bracketSize).fill(null);
      for (let i = 0; i < n; i++) {
        seeded[i] = sortedPlayers[i];
      }

      // Determine round names
      const roundNames: Record<number, string> = {
        2: "Final",
        4: "Semifinal",
        8: "Cuartos",
        16: "Octavos",
        32: "16vos",
        64: "32vos",
        128: "64vos",
        256: "128vos",
      };

      // Generate first round matches
      const firstRoundMatches = [];
      const roundName = roundNames[bracketSize] || `Ronda de ${bracketSize}`;
      
      for (let i = 0; i < bracketSize / 2; i++) {
        const p1 = seeded[i];
        const p2 = seeded[bracketSize - 1 - i];
        
        // Only create match if at least one player exists
        if (p1 || p2) {
          firstRoundMatches.push({
            tournament_id,
            player1_id: p1?.id || null,
            player2_id: p2?.id || null,
            round: roundName,
            match_order: i + 1,
            // Auto-win if opponent is null (bye)
            ...(p1 && !p2 ? { winner_id: p1.id, player1_score: 3, player2_score: 0 } : {}),
            ...(!p1 && p2 ? { winner_id: p2.id, player1_score: 0, player2_score: 3 } : {}),
          });
        }
      }

      if (firstRoundMatches.length > 0) {
        const { error } = await supabase.from("matches").insert(firstRoundMatches);
        if (error) throw error;
      }

      // Update tournament status
      await supabase.from("tournaments").update({ status: "in_progress" }).eq("id", tournament_id);

      return new Response(
        JSON.stringify({ success: true, matches_created: firstRoundMatches.length }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Acción no válida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
