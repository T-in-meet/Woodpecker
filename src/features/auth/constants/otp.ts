import { OtpPurpose, SupabaseOtpType } from "../types/otp";

/**
 * 서비스 OTP 목적을 Supabase OTP 인증 타입으로 변환한다.
 *
 * signup
 * → 회원가입 이메일 인증
 * → Supabase magiclink 사용
 *
 * reset-password
 * → 비밀번호 재설정 인증
 * → Supabase recovery 사용
 */
export const OTP_PURPOSE_TO_SUPABASE_TYPE: Record<OtpPurpose, SupabaseOtpType> =
  {
    signup: "magiclink",
    "reset-password": "recovery",
  };

/**
 * OTP 입력 길이.
 *
 * Supabase OTP 기본 정책(6자리)을 기준으로 사용한다.
 *
 * 사용 목적:
 * - OTP 입력 UI maxLength
 * - OTP schema validation
 * - placeholder 및 UX 표시
 * - 테스트 데이터 구성
 *
 * 주의:
 * - 실제 OTP 생성 및 검증 정책은 Supabase가 관리한다.
 * - 이 값은 서비스 내부 입력/표현 기준으로 사용된다.
 */
export const OTP_CODE_LENGTH = 6;
