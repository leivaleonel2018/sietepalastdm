import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token" };

const ADMIN_TOKEN = "admin_token";

function respond(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

// Placement points table
const PLACEMENT_POINTS: Record<string, number> = {
  campeon: 30, subcampeon: 25, tercero: 21, "4to": 17,
  "8vo": 13, "16vo": 10, "32vo": 8, "64vo": 6, "128vo": 4, grupo_perdido: -2,
};

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

  const { data: recentMatches } = await supabase.from("matches").select("winner_id, created_at").or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`).order("created_at", { ascending: false }).limit(5);
  const { data: recentChallenges } = await supabase.from("challenges").select("winner_id, created_at").or(`challenger_id.eq.${playerId},challenged_id.eq.${playerId}`).eq("status", "completed").order("created_at", { ascending: false }).limit(5);
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

// Auto-award placement points based on tournament round
function getPlacementFromRound(round: string, isWinner: boolean, totalRounds: number): string | null {
  const r = round.toLowerCase();
  if (r === "final") return isWinner ? "campeon" : "subcampeon";
  if (r === "semifinal") return isWinner ? null : "4to"; // losers get 4th
  if (r === "cuartos") return isWinner ? null : "8vo";
  if (r === "octavos") return isWinner ? null : "16vo";
  if (r === "16vos") return isWinner ? null : "32vo";
  return null;
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

    if (action === "delete_player") {
      const { player_id } = data;
      if (!player_id) return respond({ error: "ID requerido" });
      // Delete related data
      await supabase.from("player_badges").delete().eq("player_id", player_id);
      await supabase.from("messages").delete().eq("player_id", player_id);
      await supabase.from("challenges").delete().or(`challenger_id.eq.${player_id},challenged_id.eq.${player_id}`);
      await supabase.from("tournament_registrations").delete().eq("player_id", player_id);
      const { error } = await supabase.from("players").delete().eq("id", player_id);
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
      const loser_id = winner_id === player1_id ? player2_id : player1_id;

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

      // Auto placement points for losers
      if (round) {
        const loserPlacement = getPlacementFromRound(round, false, 0);
        if (loserPlacement && loser_id) {
          const pts = PLACEMENT_POINTS[loserPlacement] || 0;
          if (pts !== 0) {
            const { data: loserData } = await supabase.from("players").select("rating").eq("id", loser_id).single();
            if (loserData) await supabase.from("players").update({ rating: loserData.rating + pts }).eq("id", loser_id);
          }
        }
      }

      if (existing_match_id) {
        const { error } = await supabase.from("matches").update({
          player1_score: p1Score, player2_score: p2Score, winner_id,
          rating_change_p1: rc1, rating_change_p2: rc2, set_scores
        }).eq("id", existing_match_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("matches").insert({
          tournament_id, player1_id, player2_id, player1_score: p1Score, player2_score: p2Score,
          winner_id, round, group_name, match_order, rating_change_p1: rc1, rating_change_p2: rc2, set_scores
        }).select().single();
        if (error) throw error;
      }

      // Check badges
      await checkAndAwardBadges(supabase, player1_id);
      await checkAndAwardBadges(supabase, player2_id);

      // Auto-close tournament if this was the final
      if (round?.toLowerCase() === "final" && tournament_id) {
        await supabase.from("tournaments").update({ status: "finished" }).eq("id", tournament_id);

        // Award champion points and badge
        const winnerPlacement = "campeon";
        const pts = PLACEMENT_POINTS[winnerPlacement];
        const { data: winnerData } = await supabase.from("players").select("rating").eq("id", winner_id).single();
        if (winnerData) await supabase.from("players").update({ rating: winnerData.rating + pts }).eq("id", winner_id);

        // Award champion badge
        const { data: champBadge } = await supabase.from("badges").select("id").eq("name", "Campeón de torneo").single();
        if (champBadge) {
          await supabase.from("player_badges").insert({ player_id: winner_id, badge_id: champBadge.id, tournament_id }).catch(() => {});
        }
      }

      return respond({ success: true });
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
      return respond({ success: true });
    }

    if (action === "add_placement_points") {
      const { player_id, placement } = data;
      const points = PLACEMENT_POINTS[placement] || 0;
      const { data: player } = await supabase.from("players").select("rating").eq("id", player_id).single();
      if (player) await supabase.from("players").update({ rating: player.rating + points }).eq("id", player_id);
      return respond({ success: true, points });
    }

    if (action === "edit_rating") {
      const { player_id, rating } = data;
      const { error } = await supabase.from("players").update({ rating: Number(rating) }).eq("id", player_id);
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "admin_create_challenge") {
      const { challenger_id, challenged_id } = data;
      const { error } = await supabase.from("challenges").insert({ challenger_id, challenged_id, status: "accepted" });
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "admin_record_challenge_result") {
      const { challenge_id, set_scores } = data;
      const { data: challenge, error: cErr } = await supabase.from("challenges").select("*").eq("id", challenge_id).single();
      if (cErr || !challenge) return respond({ error: "Desafío no encontrado" });

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
      
      return respond({ success: true });
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

      const groupMatches = currentMatches.filter((m: any) => m.group_name);
      const elimMatches = currentMatches.filter((m: any) => !m.group_name);
      
      let winners: string[] = [];
      let nextRoundName = "";

      if (elimMatches.length === 0 && groupMatches.length > 0) {
        // Transition from groups to elimination
        const unfinishedGroups = groupMatches.filter((m: any) => !m.winner_id);
        if (unfinishedGroups.length > 0) return respond({ error: "Hay partidos de grupo sin resultado" });
        
        // Calculate standings and take top 2 from each group
        const groupNames = [...new Set(groupMatches.map((m: any) => m.group_name))];
        for (const gName of groupNames) {
          const gMatches = groupMatches.filter((m: any) => m.group_name === gName);
          const pIds = [...new Set(gMatches.flatMap((m: any) => [m.player1_id, m.player2_id]))].filter(Boolean);
          const stats = pIds.map(id => {
            const matches = gMatches.filter((m: any) => m.player1_id === id || m.player2_id === id);
            let points = 0;
            matches.forEach((m: any) => {
              if (m.winner_id === id) points += 2; else points += 1;
            });
            return { id, points };
          }).sort((a, b) => b.points - a.points);
          
          // Take top 2
          if (stats[0]) winners.push(stats[0].id);
          if (stats[1]) winners.push(stats[1].id);
        }
        
        const rn: Record<number, string> = { 2: "Final", 4: "Semifinal", 8: "Cuartos", 16: "Octavos", 32: "16vos" };
        nextRoundName = rn[winners.length] || `Ronda de ${winners.length}`;
      } else {
        const unfinished = elimMatches.filter((m: any) => !m.winner_id);
        if (unfinished.length > 0) return respond({ error: "Hay partidos sin resultado en la ronda actual" });

        const rounds = [...new Set(elimMatches.map((m: any) => m.round))];
        const latestRound = rounds[rounds.length - 1];
        const latestMatches = elimMatches.filter((m: any) => m.round === latestRound);

        if (latestMatches.length <= 1) return respond({ error: "El torneo ya terminó" });

        winners = latestMatches.map((m: any) => m.winner_id).filter(Boolean);
        const rn: Record<number, string> = { 1: "Final", 2: "Final", 4: "Semifinal", 8: "Cuartos", 16: "Octavos" };
        nextRoundName = rn[winners.length] || `Ronda de ${winners.length}`;
      }

      const nextMatches: any[] = [];
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          nextMatches.push({
            tournament_id, player1_id: winners[i], player2_id: winners[i + 1],
            round: nextRoundName, match_order: Math.floor(i / 2) + 1,
          });
        } else {
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

    // Badge management
    if (action === "create_badge") {
      const { name, description, icon_url, type } = data;
      if (!name) return respond({ error: "Nombre requerido" });
      const { error } = await supabase.from("badges").insert({ name, description, icon_url, type: type || "manual" });
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "delete_badge") {
      const { badge_id } = data;
      await supabase.from("player_badges").delete().eq("badge_id", badge_id);
      const { error } = await supabase.from("badges").delete().eq("id", badge_id);
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "award_badge") {
      const { player_id, badge_id, tournament_id } = data;
      const { error } = await supabase.from("player_badges").insert({ player_id, badge_id, tournament_id: tournament_id || null });
      if (error) return respond({ error: error.message.includes("unique") ? "Ya tiene esta insignia" : error.message });
      return respond({ success: true });
    }

    if (action === "revoke_badge") {
      const { player_id, badge_id } = data;
      const { error } = await supabase.from("player_badges").delete().eq("player_id", player_id).eq("badge_id", badge_id);
      if (error) throw error;
      return respond({ success: true });
    }

    return respond({ error: "Acción no válida" });
  } catch (e) {
    return respond({ error: "Error interno del servidor" }, 500);
  }
});
