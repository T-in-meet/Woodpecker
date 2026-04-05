import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().email("올바른 이메일을 입력해주세요"),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
});

export type LoginInput = z.infer<typeof loginFormSchema>;
