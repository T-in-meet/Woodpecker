import { z } from "zod";

export const profileSchema = z.object({
  nickname: z
    .string()
    .min(2, "닉네임은 2자 이상이어야 합니다")
    .max(10, "닉네임은 10자 이내로 입력해주세요"),
  avatarUrl: z
    .string()
    .url("올바른 URL을 입력해주세요")
    .optional()
    .or(z.literal("")),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    newPassword: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "새 비밀번호가 일치하지 않습니다",
    path: ["confirmNewPassword"],
  });

export type ProfileFormInput = z.infer<typeof profileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
