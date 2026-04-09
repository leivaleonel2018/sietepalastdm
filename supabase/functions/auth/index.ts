import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-token" };

const ADMIN_USERNAME = "leiva leonel";
const ADMIN_PASSWORD = "Leonelsl15";

function respond(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "tdm_siete_palmas_salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, ...data } = await req.json();

    if (action === "register") {
      const { full_name, dni, password } = data;
      if (!full_name || !dni || !password) return respond({ error: "Todos los campos son obligatorios" });
      if (full_name.length > 100 || dni.length > 20 || password.length < 6 || password.length > 50) {
        return respond({ error: "Datos inválidos. La contraseña debe tener al menos 6 caracteres." });
      }
      const { data: existing } = await supabase.from("players").select("id").or(`full_name.eq.${full_name},dni.eq.${dni}`).limit(1);
      if (existing && existing.length > 0) return respond({ error: "Ya existe un jugador con ese nombre o DNI" });

      const password_hash = await hashPassword(password);
      const { data: player, error } = await supabase
        .from("players")
        .insert({ full_name: full_name.trim(), dni: dni.trim(), password_hash, rating: 600 })
        .select("id, full_name, dni, rating")
        .single();
      if (error) {
        const msg = error.message.includes("unique") ? "Ya existe un jugador con ese nombre o DNI" : "Error al registrar";
        return respond({ error: msg });
      }
      return respond({ player, token: player.id });
    }

    if (action === "login") {
      const { dni, password } = data;
      if (!dni || !password) return respond({ error: "DNI y contraseña son obligatorios" });
      const password_hash = await hashPassword(password);
      const { data: player } = await supabase
        .from("players").select("id, full_name, dni, rating")
        .eq("dni", dni.trim()).eq("password_hash", password_hash).single();
      if (!player) return respond({ error: "DNI o contraseña incorrectos" });
      return respond({ player, token: player.id });
    }

    if (action === "admin_login") {
      const { username, password } = data;
      if (username?.toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        return respond({ admin: true, token: "admin_token" });
      }
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
      const { error } = await supabase.from("players").update({ password_hash: new_hash }).eq("id", player_id);
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "create_challenge") {
      const { challenger_id, challenged_id, player_token } = data;
      if (!challenger_id || !challenged_id) return respond({ error: "Jugadores requeridos" });
      if (challenger_id === challenged_id) return respond({ error: "No podés desafiarte a vos mismo" });
      if (player_token !== challenger_id) return respond({ error: "No autorizado" });

      // Check no pending challenge between them
      const { data: existing } = await supabase
        .from("challenges")
        .select("id")
        .or(`and(challenger_id.eq.${challenger_id},challenged_id.eq.${challenged_id}),and(challenger_id.eq.${challenged_id},challenged_id.eq.${challenger_id})`)
        .in("status", ["pending", "accepted"])
        .limit(1);
      if (existing && existing.length > 0) return respond({ error: "Ya existe un desafío activo entre estos jugadores" });

      const { error } = await supabase.from("challenges").insert({ challenger_id, challenged_id });
      if (error) throw error;
      return respond({ success: true });
    }

    if (action === "respond_challenge") {
      const { challenge_id, player_id, accept, player_token } = data;
      if (player_token !== player_id) return respond({ error: "No autorizado" });

      const { data: challenge } = await supabase
        .from("challenges").select("*").eq("id", challenge_id).eq("challenged_id", player_id).eq("status", "pending").single();
      if (!challenge) return respond({ error: "Desafío no encontrado" });

      const newStatus = accept ? "accepted" : "rejected";
      const { error } = await supabase.from("challenges").update({ status: newStatus }).eq("id", challenge_id);
      if (error) throw error;
      return respond({ success: true });
    }

    return respond({ error: "Acción no válida" });
  } catch (e) {
    return respond({ error: "Error interno del servidor" });
  }
});
