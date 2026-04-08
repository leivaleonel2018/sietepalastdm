import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

const ADMIN_USERNAME = "leiva leonel";
const ADMIN_PASSWORD = "Leonelsl15";

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
      if (!full_name || !dni || !password) {
        return new Response(
          JSON.stringify({ error: "Todos los campos son obligatorios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (full_name.length > 100 || dni.length > 20 || password.length < 6 || password.length > 50) {
        return new Response(
          JSON.stringify({ error: "Datos inválidos. La contraseña debe tener al menos 6 caracteres." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check existing
      const { data: existing } = await supabase
        .from("players")
        .select("id")
        .or(`full_name.eq.${full_name},dni.eq.${dni}`)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ error: "Ya existe un jugador con ese nombre o DNI" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const password_hash = await hashPassword(password);
      const { data: player, error } = await supabase
        .from("players")
        .insert({ full_name: full_name.trim(), dni: dni.trim(), password_hash, rating: 600 })
        .select("id, full_name, dni, rating")
        .single();

      if (error) {
        const msg = error.message.includes("unique") 
          ? "Ya existe un jugador con ese nombre o DNI" 
          : "Error al registrar";
        return new Response(
          JSON.stringify({ error: msg }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ player, token: player.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "login") {
      const { dni, password } = data;
      if (!dni || !password) {
        return new Response(
          JSON.stringify({ error: "DNI y contraseña son obligatorios" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const password_hash = await hashPassword(password);
      const { data: player } = await supabase
        .from("players")
        .select("id, full_name, dni, rating")
        .eq("dni", dni.trim())
        .eq("password_hash", password_hash)
        .single();

      if (!player) {
        return new Response(
          JSON.stringify({ error: "DNI o contraseña incorrectos" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ player, token: player.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "admin_login") {
      const { username, password } = data;
      if (username?.toLowerCase() === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        return new Response(
          JSON.stringify({ admin: true, token: "admin_token" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Credenciales de admin incorrectas" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
