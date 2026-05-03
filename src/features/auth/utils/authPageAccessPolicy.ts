import { ROUTES } from "@/lib/constants/routes";

/**
 * 로그인 상태의 사용자가 접근하면 안 되는 인증 페이지 목록
 *
 * 포함 대상:
 * - 회원가입
 * - 로그인
 * - 이메일 인증
 * - 비밀번호 재설정 요청
 *
 * 특징:
 * - session 존재 시 접근 차단 대상
 * - middleware에서 접근 정책 판단에 사용됨
 */
const GUEST_ONLY_PATHS: readonly string[] = [
  ROUTES.SIGNUP,
  ROUTES.LOGIN,
  ROUTES.VERIFY_EMAIL,
  ROUTES.FORGOT_PASSWORD,
];

/**
 * 주어진 경로가 "비로그인 사용자 전용 인증 페이지"인지 판별한다.
 *
 * @param path 현재 요청 경로 (pathname)
 * @returns 해당 경로가 guest-only 인증 페이지이면 true
 */
export function isGuestOnlyAuthPath(path: string): boolean {
  return GUEST_ONLY_PATHS.includes(path);
}

/**
 * 주어진 경로가 "세션이 필요한 인증 페이지"인지 판별한다.
 *
 * 현재는 reset-password만 해당한다.
 *
 * @param path 현재 요청 경로 (pathname)
 * @returns 해당 경로가 세션 필요 페이지이면 true
 */
export function isSessionRequiredAuthPath(path: string): boolean {
  return path === ROUTES.RESET_PASSWORD;
}

/**
 * 주어진 경로가 인증 접근 제어 대상인지 판별한다.
 *
 * 조건:
 * - guest-only auth page
 * - session-required auth page
 *
 * @param path 현재 요청 경로 (pathname)
 * @returns 접근 제어 대상이면 true
 */
export function isAuthAccessControlledPath(path: string): boolean {
  return isGuestOnlyAuthPath(path) || isSessionRequiredAuthPath(path);
}

/**
 * 인증 페이지 접근 정책에 따라 차단 시 이동할 경로를 결정한다.
 *
 * 정책:
 * - 로그인 사용자가 guest-only 페이지 접근 → HOME으로 이동
 * - 비로그인 사용자가 reset-password 접근 → forgot-password로 이동
 * - 그 외 → 차단 없음 (null)
 *
 * @param params.pathname 현재 요청 경로
 * @param params.hasSession 세션 존재 여부
 * @returns redirect 대상 경로 또는 null
 */
export function getBlockedAuthPageRedirectPath({
  pathname,
  hasSession,
}: {
  pathname: string;
  hasSession: boolean;
}): string | null {
  if (isGuestOnlyAuthPath(pathname) && hasSession) {
    return ROUTES.MYPAGE;
  }

  if (isSessionRequiredAuthPath(pathname) && !hasSession) {
    return ROUTES.FORGOT_PASSWORD;
  }

  return null;
}
