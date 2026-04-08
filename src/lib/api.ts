const getBaseUrl = () => {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  return `https://${projectId}.supabase.co/functions/v1`;
};

export async function adminAction(action: string, data: Record<string, unknown>, adminToken: string) {
  const res = await fetch(`${getBaseUrl()}/admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "x-admin-token": adminToken,
    },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}
