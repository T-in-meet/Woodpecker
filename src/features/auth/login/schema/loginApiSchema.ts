import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";
import { passwordSchema } from "@/lib/validation/passwordSchema";

/**
 * 로그인 API 입력 검증 스키마
 *
 * 역할:
 * - POST /api/auth/login 요청 body를 검증하는 boundary schema
 * - 허용된 필드(email, password)만 수락하고 나머지는 거부한다
 *
 * 설계 원칙:
 * - strict(): extra field를 허용하지 않아 의도하지 않은 데이터 주입을 방지
 * - email은 normalizedEmailSchema로 trim + 형식 검증
 * - password는 trim하지 않는다 (사용자가 의도한 값이 그대로 인증에 사용됨)
 *
 * spec 근거: login-spec.md §4.2 Validation, §4.3 Schema Rules
 */
export const loginApiSchema = z
  .object({
    email: normalizedEmailSchema,
    password: passwordSchema,
  })
  .strict();
