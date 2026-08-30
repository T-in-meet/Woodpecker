import { redirect } from "next/navigation";

import { getLegalAcceptanceRequiredPath } from "@/features/auth/lib/userAgreements";

/**
 * 인증·이메일 확인이 끝난 사용자의 최신 법적 문서 확인 여부를 검사합니다.
 *
 * Server Action은 페이지 레이아웃을 거치지 않고 직접 호출될 수 있으므로,
 * 서비스 작업을 수행하기 직전에 이 가드를 호출해야 합니다.
 */
export async function requireCurrentLegalAcceptance(
  userId: string,
  redirectPath?: string | null,
): Promise<void> {
  const requiredPath = await getLegalAcceptanceRequiredPath(
    userId,
    redirectPath,
  );

  if (requiredPath) redirect(requiredPath);
}
