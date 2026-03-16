import { z } from "zod";

export const profileSchema = z.object({
  username: z.string().min(2, "사용자명은 2자 이상이어야 합니다").max(20),
  bio: z.string().max(200, "소개는 200자 이내로 입력해주세요").optional(),
  avatarUrl: z.string().url().optional(),
});

export type ProfileInput = z.infer<typeof profileSchema>;
