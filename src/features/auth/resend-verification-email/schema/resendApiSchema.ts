import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";

/**
 * 재전송 요청 스키마 (API boundary)
 *
 * - email: 공용 normalizedEmailSchema 사용
 *   - trim / normalize / format 검증을 공통 규칙으로 통일
 * - auth 내 모든 email 입력 경계 규칙 일관성 유지 목적
 */
export const resendApiSchema = z.object({
  email: normalizedEmailSchema,
});

export type ResendRequest = z.infer<typeof resendApiSchema>;
