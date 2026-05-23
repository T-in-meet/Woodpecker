"use client";

import { useRouter } from "next/navigation";

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

  const { mutateAsync, isPending } = useSignupMutation();

  return (
    <SignupForm
      onSubmit={async (values) => {
        const { termsOfService, privacyPolicy, ...rest } = values;

        const response = await mutateAsync({
          ...rest,
          agreements: { termsOfService, privacyPolicy },
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
