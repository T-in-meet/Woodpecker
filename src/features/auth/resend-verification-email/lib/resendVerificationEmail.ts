import { createClient } from "@/lib/supabase/server";

/**
 * 이메일 인증 재전송 요청
 *
 * @param email 대상 사용자 이메일
 *
 * 동작:
 * - Supabase Auth의 resend API 호출
 * - signup 타입의 인증 메일을 다시 발송
 *
 * 예외 처리:
 * - Supabase에서 에러 반환 시 Error throw
 * - 상위 레이어에서 에러를 받아 API 응답 형태로 매핑
 *
 * ⚠️ 주의사항
 * - 이 함수는 단순히 Supabase 호출만 담당 (side-effect)
 * - rate limit / cooldown 로직은 외부에서 처리해야 함
 */
export async function resendVerificationEmail(email: string): Promise<void> {
  /**
   * 서버용 Supabase 클라이언트 생성
   */
  const supabase = await createClient();

  /**
   * 이메일 인증 재전송 요청
   * - type: "signup" → 회원가입 인증 메일
   */
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });

  /**
   * 에러 발생 시 상위로 전파
   * - 메시지만 포함된 Error 객체 생성
   */
  if (error) {
    throw new Error(error.message);
  }
}
