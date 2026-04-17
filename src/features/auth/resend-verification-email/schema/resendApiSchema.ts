import { z } from "zod";

/**
 * 재전송 요청 스키마
 *
 * - email: 문자열 → trim → 필수값 검증 → 이메일 형식 검증
 * - boundary validation (외부 입력 검증) 역할
 */
export const resendApiSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1).email(),
  ),
});
