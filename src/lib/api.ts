import { supabase } from "@/integrations/supabase/client";

export async function adminAction(action: string, data: Record<string, unknown>, adminToken: string) {
  const { data: result, error } = await supabase.functions.invoke("admin", {
    body: { action, ...data },
    headers: { "x-admin-token": adminToken },
  });
  if (error) return { error: error.message };
  return result;
}

export async function authAction(action: string, data: Record<string, unknown>) {
  const { data: result, error } = await supabase.functions.invoke("auth", {
    body: { action, ...data },
  });
  if (error) return { error: error.message };
  return result;
}
