"use client";

import { useEffect, useState } from "react";
import { z } from "zod";

import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/profiles.types";

const profileRowSchema = z.object({
  id: z.string().uuid(),
  nickname: z.string(),
  avatar_url: z.string().nullable(),
  role: z.enum(["USER", "ADMIN"]),
  created_at: z.string(),
  updated_at: z.string(),
});

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetchProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      const parsed = profileRowSchema.safeParse(data);
      setProfile(parsed.success ? (parsed.data as Profile) : null);
      setIsLoading(false);
    }

    void fetchProfile();
  }, []);

  return { profile, isLoading };
}
