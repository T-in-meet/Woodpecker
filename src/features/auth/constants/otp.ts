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
export const OTP_LENGTH = 6;

/**
 * OTP 발급 결과에 email_otp가 존재하지 않을 때 사용하는 에러 메시지
 *
 * generateLink 결과가 비정상적이거나
 * OTP 발급에 실패한 상황에서 사용한다.
 */
export const MISSING_EMAIL_OTP_ERROR_MESSAGE = "인증 번호를 받지 못했습니다.";

/**
 * OTP 만료 시간(초 단위)
 *
 * 이메일 안내 문구 및
 * OTP 인증 정책의 기준값으로 사용한다.
 */
export const OTP_EXPIRES_IN_SECONDS = 3600;

/**
 * OTP 만료 시간(분 단위)
 *
 * 사용자에게 표시할 이메일 안내 문구 등
 * 사람이 읽기 쉬운 형태가 필요한 UI 계층에서 사용한다.
 */
export const OTP_EXPIRES_IN_MINUTES = Math.floor(OTP_EXPIRES_IN_SECONDS / 60);

/**
 * 서비스 내부 OTP 인증 목적 목록.
 *
 * signup:
 * - 회원가입 이메일 인증 흐름
 *
 * reset-password:
 * - 비밀번호 재설정 인증 흐름
 * - verifyOtp 성공 이후 reset-password 페이지로 연결된다.
 *
 * 사용 목적:
 * - zod enum schema 생성
 * - OTP 목적 타입 추론
 * - 인증 흐름 분기 처리
 */
export const OTP_PURPOSES = ["signup", "reset-password"] as const;

/**
 * 서비스 내부 OTP 인증 목적 타입.
 *
 * OTP_PURPOSES 상수를 기반으로 생성된다.
 */
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/**
 * Supabase OTP 인증 타입 목록.
 *
 * magiclink:
 * - 회원가입 이메일 인증에 사용
 *
 * recovery:
 * - 비밀번호 재설정(recovery) 인증에 사용
 *
 * 사용 목적:
 * - zod enum schema 생성
 * - Supabase OTP 타입 추론
 * - OTP 목적 → Supabase 타입 매핑
 */
export const SUPABASE_OTP_TYPES = ["magiclink", "recovery"] as const;

/**
 * Supabase OTP 인증 타입.
 *
 * SUPABASE_OTP_TYPES 상수를 기반으로 생성된다.
 */
export type SupabaseOtpType = (typeof SUPABASE_OTP_TYPES)[number];
