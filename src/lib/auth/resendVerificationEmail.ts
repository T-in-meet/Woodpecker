import { createClient } from "@/lib/supabase/server";

export async function resendVerificationEmail(email: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  if (error) {
    throw new Error(error.message);
  }
}
