"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { AGREEMENT_REQUIRED_NOTICE_MESSAGE } from "@/features/auth/constants/agreementRequired";
import {
  OAUTH_CALLBACK_ERROR_MESSAGE,
  OAUTH_CALLBACK_ERROR_PARAM,
} from "@/features/auth/constants/oauthCallbackError";
import { SignupForm } from "@/features/auth/signup/components/SignupForm";
import { useSignupMutation } from "@/features/auth/signup/hooks/useSignupMutation";

/**
 * 회원가입 페이지의 클라이언트 컴포넌트
 *
 * 책임:
 * - 서버 요청 (mutation) 실행
 * - 성공 시 라우팅 처리
 *
 * 분리 이유:
 * - SignupForm: 순수 UI + validation
 * - PageClient: side-effect (API 호출, 라우팅)
 */
export default function SignupPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasAgreementRequiredNotice =
    searchParams.get("agreement_required") === "1";

  const hasOAuthCallbackError = Boolean(
    searchParams.get(OAUTH_CALLBACK_ERROR_PARAM),
  );

  const { mutateAsync, isPending } = useSignupMutation();

  // 다시 시도해야 하는 오류라 사라지는 토스트 대신 폼 상단 배너에 남긴다.
  // 배너 자리는 하나뿐이라 우선순위를 명시한다. 약관 재동의 요구가 더 구체적인
  // 다음 행동을 알려주므로 앞선다.
  const signupNotice = hasAgreementRequiredNotice
    ? AGREEMENT_REQUIRED_NOTICE_MESSAGE
    : hasOAuthCallbackError
      ? OAUTH_CALLBACK_ERROR_MESSAGE
      : undefined;

  return (
    <SignupForm
      {...(hasAgreementRequiredNotice
        ? { initialSignupMethod: "google" as const }
        : {})}
      {...(signupNotice ? { signupNotice } : {})}
      onSubmit={async (values) => {
        const {
          termsOfService,
          privacyPolicyAcknowledged,
          age14OrOlder,
          ...rest
        } = values;

        const response = await mutateAsync({
          ...rest,
          agreements: {
            termsOfService,
            privacyPolicyAcknowledged,
            age14OrOlder,
          },
        });

        /**
         * 서버 응답 기반 라우팅
         * - 서버가 redirect 정책을 결정한다.
         * - 클라이언트는 전달받은 경로를 그대로 따른다.
         */
        router.push(response.data.redirectTo);
      }}
      isPending={isPending}
    />
  );
}
