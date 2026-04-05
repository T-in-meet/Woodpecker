"use server";

import { loginFormSchema } from "./schema/schema";

export async function loginAction(_prevState: unknown, formData: FormData) {
  const parsed = loginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  // TODO: Supabase auth
}
