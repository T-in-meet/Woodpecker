import { unstable_cache } from "next/cache";
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

export const PROFILE_CACHE_TAG = (userId: string) => `profile-${userId}`;

const fetchProfileById = (userId: string) =>
  unstable_cache(
    async () => {
      const supabase = await createServerComponentClient();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      const parsed = profileDbSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },
    ["profile", userId],
    { tags: [PROFILE_CACHE_TAG(userId)], revalidate: 3600 },
  );

// React.cache로 동일 요청 내 중복 호출 방지
export const getProfile = cache(async (): Promise<CachedProfile | null> => {
  const user = await getUser();
  if (!user) return null;
  return fetchProfileById(user.id)();
});
