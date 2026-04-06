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
  /**
   * Next.js 라우터 (페이지 이동)
   */
  const router = useRouter();

  /**
   * 회원가입 mutation 훅
   * - mutateAsync: 비동기 요청 실행
   * - isPending: 요청 진행 상태
   */
  const { mutateAsync, isPending } = useSignupMutation();

  return (
    <SignupForm
      /**
       * 폼 제출 핸들러
       *
       * 동작:
       * 1. 폼 데이터 변환 (flat → API 구조)
       * 2. mutation 실행
       * 3. 응답 기반으로 리다이렉트
       */
      onSubmit={async (values) => {
        /**
         * agreements 필드 분리
         * - 폼에서는 flat 구조
         * - API는 nested 구조 요구
         */
        const { termsOfService, privacyPolicy, ...rest } = values;

        /**
         * 회원가입 요청
         */
        const response = await mutateAsync({
          ...rest,
          agreements: { termsOfService, privacyPolicy },
        });

        /**
         * 서버 응답 기반 리다이렉트
         * - 프론트에서 경로를 추론하지 않음
         */
        router.push(response.data.redirectTo);
      }}
      /**
       * 로딩 상태 전달
       * - 중복 제출 방지 및 UI 상태 제어
       */
      isPending={isPending}
    />
  );
}
