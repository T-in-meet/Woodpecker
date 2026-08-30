import { ROUTES } from "@/lib/constants/routes";

export const AGREEMENT_REQUIRED_PATH = ROUTES.AGREEMENTS;
export const SIGNUP_AGREEMENT_REQUIRED_PATH = "/signup?agreement_required=1";

export const AGREEMENT_REQUIRED_NOTICE_MESSAGE =
  "서비스를 계속 이용하려면 최신 이용약관 동의와 개인정보 처리방침 확인이 필요합니다.";

export function getAgreementRequiredPath(redirectPath?: string): string {
  if (!redirectPath) return AGREEMENT_REQUIRED_PATH;

  return `${AGREEMENT_REQUIRED_PATH}?redirect=${encodeURIComponent(redirectPath)}`;
}
