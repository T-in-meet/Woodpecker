"use client";

/**
 * 이메일 인증 안내 페이지 클라이언트 컴포넌트
 *
 * 설계 의도:
 * - 회원가입 완료 후 이메일 인증을 유도하는 단일 진입점 역할을 한다.
 * - 인증 메일 재발송 기능을 제공하며, 남용 방지를 위해 rate limit을 처리한다.
 * - auth-rules.md 정책에 따라 회원 상태(신규/미인증/인증)를 프론트에서 구분하지 않는다.
 *   → 서버 응답 코드 기반으로도 계정 상태를 추론할 수 없도록 동일한 UX 흐름을 유지한다.
 *
 * rate limit 처리:
 * - 클라이언트는 쿨다운 타이머나 남은 시간을 추적하지 않는다.
 * - HTTP status(예: 429)에 의존하지 않고, 서버 response body의 `code`를 기준으로 처리한다.
 * - rate limit 발생 시, 이벤트 기반의 전역 토스트 메시지(showToast)로만 피드백한다.
 */

import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import {
  GLOBAL_ERROR_MESSAGES,
  isGlobalError,
} from "@/features/auth/errors//globalError";
import { UNKNOWN_ERROR_MESSAGE } from "@/features/auth/errors//unknownError";
import {
  isRateLimitError,
  RATE_LIMIT_TOAST_MESSAGE,
} from "@/features/auth/errors/rateLimitError";
/**
 * 🔽 추가: mutation 훅 import
 * - fetch를 직접 호출하던 구조를 제거하고
 * - API 호출을 mutation 레이어로 위임하기 위해 사용한다.
 */
import { useResendVerificationEmailMutation } from "@/features/auth/resend-verification-email/hooks/useResendVerificationEmailMutation";
import { showToast } from "@/lib/utils/showToast";

type FormValues = {
  email: string;
};

type Props = {
  email?: string | undefined;
};

export default function VerifyEmailPageClient({ email }: Props) {
  /**
   * pre-fill 입력값 정규화
   *
   * 목적:
   * - URL query 기반 전달값의 앞뒤 공백 제거
   * - 빈 값(undefined/null 포함)은 빈 문자열로 통일
   *
   * 설계 의도:
   * - input 초기값과 제출값의 형태를 안정적으로 유지해
   *   동일한 사용자 입력 경험을 보장한다.
   */
  const normalizedPrefillEmail = email?.trim() ?? "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { email: normalizedPrefillEmail },
  });

  /**
   * pre-fill 동기화
   *
   * 목적:
   * - 클라이언트 내비게이션으로 `email` prop이 바뀌는 경우,
   *   폼 input 값을 최신 prop과 일치시킨다.
   *
   * 설계 의도:
   * - defaultValues는 최초 렌더 기준이므로
   *   이후 prop 변화는 reset으로 명시적으로 반영한다.
   */
  useEffect(() => {
    reset({ email: normalizedPrefillEmail });
  }, [normalizedPrefillEmail, reset]);

  /**
   * 🔽 추가: resend mutation 훅 사용
   *
   * 역할:
   * - API 호출(fetch)을 컴포넌트에서 제거하고 mutation으로 위임
   * - loading 상태(isPending)를 제공
   */
  const { mutateAsync, isPending } = useResendVerificationEmailMutation();

  /**
   * 🔽 수정: loading 상태 통합
   *
   * - form submitting 상태 + mutation pending 상태를 함께 고려
   */
  const isDisabled = isSubmitting || isPending;

  const onSubmit = async (values: FormValues) => {
    try {
      /**
       * 🔽 수정: fetch 제거 → mutation 사용
       *
       * 동작:
       * - mutation 내부에서 fetch 수행
       * - 실패 시 response body를 throw
       * - 성공 시 response body 반환
       *
       * 설계 의도:
       * - UI는 네트워크/응답 처리에서 분리
       * - SignupForm과 동일한 패턴으로 구조 통일
       */
      const body = await mutateAsync({ email: values.email });

      /**
       * 성공 처리
       *
       * 동작:
       * - 서버 response body의 `code`를 기반으로 성공 여부를 판별한다.
       * - 성공 시 사용자에게 인증 메일 재발송 완료 토스트를 노출한다.
       *
       * 설계 의도:
       * - HTTP status가 아닌 response body contract(code) 기준으로 성공을 판단한다.
       * - 모든 auth 흐름에서 동일한 방식으로 응답을 해석하도록 일관성을 유지한다.
       */
      if (body.code === AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS) {
        showToast("인증 메일이 재발송되었습니다.");
      }
    } catch (e) {
      console.error("Failed to resend email:", e);

      /**
       * rate limit 에러 처리
       *
       * 동작:
       * - mutation에서 throw된 response body의 `code`를 기반으로 rate limit 여부를 판별한다.
       * - rate limit에 해당하면 사용자에게 공통 토스트 메시지를 노출하고 흐름을 중단한다.
       *
       * 설계 의도:
       * - HTTP status(예: 429)에 의존하지 않고, response body contract(code) 기준으로 처리한다.
       * - validation / global error와 구분되는 "도메인 에러 계층"으로 취급한다.
       */
      if (isRateLimitError(e)) {
        showToast(RATE_LIMIT_TOAST_MESSAGE, "destructive");
        return;
      }

      /**
       * 글로벌 에러 처리 (network, timeout 등)
       *
       * 동작:
       * - 네트워크 실패, 타임아웃 등 transport/infra 계층의 에러를 처리한다.
       * - 해당 에러 타입에 맞는 메시지를 토스트로 노출하고 흐름을 종료한다.
       *
       * 설계 의도:
       * - 서버가 반환한 도메인 에러(response body 기반)와 구분한다.
       */
      if (isGlobalError(e)) {
        showToast(GLOBAL_ERROR_MESSAGES[e.type], "destructive");
        return;
      }

      /**
       * fallback 처리 (unknown error)
       *
       * 동작:
       * - 정의된 에러 타입으로 판별되지 않는 모든 예외를 처리한다.
       * - 사용자에게 일반적인 오류 메시지를 토스트로 노출한다.
       *
       * 설계 의도:
       * - 예상하지 못한 에러(contract 위반, 런타임 예외 등)에 대해
       *   최소한의 사용자 피드백을 보장한다.
       */
      showToast(UNKNOWN_ERROR_MESSAGE, "destructive");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="text-base leading-relaxed">
          회원가입이 완료되었습니다.
          <br />
          가입하실 때 사용하신 이메일에서 인증 이메일을 확인해주세요.
        </p>

        <form
          aria-label="인증 메일 재발송"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="space-y-2 text-left">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isDisabled}>
            인증 메일 재발송
          </Button>
        </form>
      </div>
    </div>
  );
}
