/**
 * 서비스 OTP purpose를 Supabase verifyOtp 타입으로 변환한다.
 *
 * signup
 * → 신규 Signup의 signup token과 기존 사용자 재발급의 magiclink token을
 *   동일한 Signup Verify 흐름에서 검증하기 위해 Supabase email 타입을 사용한다.
 *
 * reset-password
 * → 비밀번호 재설정 인증
 * → Supabase recovery 사용
 */
export const OTP_PURPOSE_TO_SUPABASE_VERIFY_TYPE: Record<
  OtpPurpose,
  SupabaseOtpVerifyType
> = {
  signup: "email",
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
 * 신규 Signup generateLink 결과에 user id가 존재하지 않을 때 사용하는 내부 에러 메시지.
 *
 * 사용자 생성과 OTP 발급을 함께 수행하는 signup Provider 응답에서
 * 약관 저장에 필요한 사용자 identity가 누락된 상태를 나타낸다.
 */
export const MISSING_SIGNUP_USER_ID_ERROR_MESSAGE =
  "회원가입 사용자 정보를 받지 못했습니다.";

/**
 * Supabase OTP generateLink 요청 timeout.
 *
 * OTP Issue의 Provider operation이 장시간 pending되는 것을 방지하고
 * timeout 시 underlying fetch를 실제 abort하기 위한 기준값이다.
 */
export const OTP_GENERATE_LINK_TIMEOUT_MS = 10 * 1000;

/**
 * OTP 이메일 delivery 전체 대기 timeout.
 *
 * Provider SDK가 resolve/reject하지 않는 경우에도 상위 OTP Issue caller가
 * 유한한 시간 안에 settle하여 in-flight guard를 release할 수 있도록 한다.
 *
 * 이 값은 Nodemailer의 개별 network phase timeout이나
 * OTP generateLink timeout과 별개의 caller-side wall-clock upper bound다.
 */
export const OTP_EMAIL_DELIVERY_TIMEOUT_MS = 20 * 1000;

/**
 * Woodpecker의 OTP hard expiration 정책 기준값.
 *
 * 사용자 안내와 서비스 정책은 10분으로 통일한다.
 * 실제 OTP 만료 enforcement는 Supabase Auth의 otp_expiry 설정이 담당하므로
 * Local/Production Supabase 설정도 반드시 같은 600초를 사용해야 한다.
 */
export const OTP_EXPIRES_IN_SECONDS = 600;

/**
 * OTP 만료 시간(분 단위).
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
 * Supabase OTP Verify 타입 목록.
 *
 * email:
 * - Signup purpose의 signup / magiclink token 검증에 사용
 *
 * recovery:
 * - 비밀번호 재설정(recovery) 인증에 사용
 */
export const SUPABASE_OTP_VERIFY_TYPES = ["email", "recovery"] as const;

/**
 * Supabase OTP Verify 타입.
 *
 * SUPABASE_OTP_VERIFY_TYPES 상수를 기반으로 생성된다.
 */
export type SupabaseOtpVerifyType = (typeof SUPABASE_OTP_VERIFY_TYPES)[number];

/**
 * OTP 인증 실패 안내 메시지.
 *
 * 사용 목적:
 * - OTP 불일치
 * - OTP 만료
 * - 재발급으로 인해 이전 OTP가 무효화된 경우
 *
 * 보안 및 UX 정책:
 * - 구체적인 실패 원인(불일치/만료)을 분리하지 않는다.
 * - 사용자가 다시 입력하거나 재전송하도록 유도한다.
 */
export const INVALID_OTP_ERROR_MESSAGE =
  "인증 번호가 올바르지 않거나 만료되었습니다.";
