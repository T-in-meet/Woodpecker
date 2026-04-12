import { issueAuthEmailLinkAndSend } from "@/features/auth/email/issueAuthEmailLinkAndSend";

/**
 * 이메일 인증 재전송 요청
 *
 * @param email 대상 사용자 이메일
 *
 * 동작:
 * - Supabase Admin generateLink로 magiclink 발급
 * - sendAuthEmail로 커스텀 인증 메일 발송
 *
 * 예외 처리:
 * - 링크 발급/토큰 추출/이메일 전송 실패 시 Error throw
 * - 상위 레이어에서 에러를 받아 API 응답 형태로 매핑
 *
 * ⚠️ 주의사항
 * - 이 함수는 메일 재전송 side-effect만 담당
 * - rate limit / cooldown 로직은 외부에서 처리해야 함
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  await issueAuthEmailLinkAndSend({
    type: "magiclink",
    email,
  });
}
