import { cache } from "react";
import { z } from "zod";

import { getUser } from "./getUser";
import { createServerComponentClient } from "./server";

const profileDbSchema = z.object({
  id: z.string(),
  nickname: z.string(),
  avatar_url: z.string().nullable(),
  role: z.enum(["USER", "ADMIN"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CachedProfile = z.infer<typeof profileDbSchema>;

export const getProfile = cache(async (): Promise<CachedProfile | null> => {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createServerComponentClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url, role, created_at, updated_at")
    .eq("id", user.id)
    .single();

  const parsed = profileDbSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
});
