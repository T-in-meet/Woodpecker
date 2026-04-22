import { z } from "zod";

import { resendSuccessResponseSchema } from "../schema/resendSuccessResponseSchema";

/**
 * 인증 메일 재전송 요청 시 사용하는 payload 타입
 */
type ResendVerificationEmailPayload = {
  email: string;
};

/**
 * 인증 메일 재전송 성공 시 서버에서 반환하는 응답 타입
 */
export type ResendVerificationEmailSuccessResponse = z.infer<
  typeof resendSuccessResponseSchema
>;

/**
 * 인증 메일 재전송 mutation 함수
 *
 * 역할:
 * 1. payload를 서버 요청 형태로 변환
 * 2. API 호출 (fetch)
 * 3. 응답 반환 또는 에러 throw
 */
export async function resendVerificationEmailMutation(
  payload: ResendVerificationEmailPayload,
): Promise<ResendVerificationEmailSuccessResponse> {
  /**
   * 인증 메일 재전송 API 요청
   */
  const response = await fetch("/api/auth/resend-verification-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  /**
   * 성공/실패 분기 전에 body를 먼저 파싱
   */
  const body = await response.json();

  /**
   * HTTP 레벨 실패 처리 (예: 400, 422, 500 등)
   *
   * 설계 의도:
   * - 서버 failure response body를 그대로 throw
   * - response contract(code, data 등)을 손실 없이 상위로 전달
   * - UI 레이어에서 code 기반으로 에러 분기 처리 가능하도록 보장
   */
  if (!response.ok) {
    throw body;
  }

  /**
   * 성공 응답 반환
   *
   * 설계 의도:
   * - Zod schema를 통해 서버 응답을 검증한다.
   * - 계약에 맞지 않는 응답은 런타임에서 바로 감지한다.
   */
  return resendSuccessResponseSchema.parse(body);
}
