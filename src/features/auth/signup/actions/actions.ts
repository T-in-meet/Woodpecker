"use server";

import { signupInputSchema } from "../schema/schema";

export async function signupAction(_prevState: unknown, formData: FormData) {
  const parsed = signupInputSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // TODO: Supabase auth
}
