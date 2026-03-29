import { createAdminClient } from "@/lib/supabase/admin";

export async function getUserByEmail(
  email: string,
): Promise<{ email: string; email_confirmed_at: string | null } | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.auth.admin.listUsers();
  const user = data.users.find((u) => u.email === email);

  if (!user) return null;

  return {
    email: user.email ?? email,
    email_confirmed_at: user.email_confirmed_at ?? null,
  };
}
