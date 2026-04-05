import { createAdminClient } from "@/lib/supabase/admin";

export async function getUserByEmail(
  email: string,
): Promise<{ email: string; email_confirmed_at: string | null } | null> {
  const supabase = createAdminClient();
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find((u) => u.email === email);

    if (user) {
      return {
        email: user.email ?? email,
        email_confirmed_at: user.email_confirmed_at ?? null,
      };
    }

    if (data.users.length < perPage) {
      return null;
    }

    page += 1;
  }
}
