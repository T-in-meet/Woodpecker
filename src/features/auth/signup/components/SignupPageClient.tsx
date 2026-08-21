"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { AGREEMENT_REQUIRED_NOTICE_MESSAGE } from "@/features/auth/constants/agreementRequired";
import {
  OAUTH_CALLBACK_ERROR_PARAM,
  OAUTH_CALLBACK_ERROR_TOAST_KEY,
  OAUTH_CALLBACK_ERROR_TOAST_MESSAGE,
} from "@/features/auth/constants/oauthCallbackError";
import { SignupForm } from "@/features/auth/signup/components/SignupForm";
import { useSignupMutation } from "@/features/auth/signup/hooks/useSignupMutation";
import { showToast } from "@/lib/utils/showToast";

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

  const { mutateAsync, isPending } = useSignupMutation();

  useEffect(() => {
    if (!searchParams.get(OAUTH_CALLBACK_ERROR_PARAM)) return;

    showToast(OAUTH_CALLBACK_ERROR_TOAST_MESSAGE, {
      variant: "destructive",
      dedupeKey: OAUTH_CALLBACK_ERROR_TOAST_KEY,
    });
  }, [searchParams]);

  return (
    <SignupForm
      {...(hasAgreementRequiredNotice
        ? {
            initialSignupMethod: "google" as const,
            signupNotice: AGREEMENT_REQUIRED_NOTICE_MESSAGE,
          }
        : {})}
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
