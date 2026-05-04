"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import {
  GLOBAL_ERROR_MESSAGES,
  isGlobalError,
} from "@/features/auth/errors/globalError";
import {
  isRateLimitError,
  RATE_LIMIT_TOAST_MESSAGE,
} from "@/features/auth/errors/rateLimitError";
import { UNKNOWN_ERROR_MESSAGE } from "@/features/auth/errors/unknownError";
import { useResendVerificationEmailMutation } from "@/features/auth/resend-verification-email/hooks/useResendVerificationEmailMutation";
import { showToast } from "@/lib/utils/showToast";

import {
  VerifyEmailFormInput,
  verifyEmailFormSchema,
  VerifyEmailFormValues,
} from "../schemas/verifyEmailFormSchema";

type Props = {
  email?: string | undefined;
};

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
    formState: { isSubmitting, errors },
  } = useForm<VerifyEmailFormInput, unknown, VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailFormSchema),
    mode: "onTouched",
    reValidateMode: "onChange",
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

  const { mutateAsync, isPending } = useResendVerificationEmailMutation();

  /**
   * 제출 중이거나 재발송 mutation이 진행 중이면 버튼을 비활성화한다.
   *
   * - 중복 제출을 방지한다.
   * - 로딩 스피너와 버튼 문구를 동일한 기준으로 제어한다.
   */
  const isDisabled = isSubmitting || isPending;

  const onSubmit = async (values: VerifyEmailFormValues) => {
    try {
      /**
       * 재발송 요청은 mutation을 통해 수행한다.
       *
       * - 네트워크 호출과 응답 파싱 책임은 mutation 레이어가 가진다.
       * - UI는 성공/실패에 따른 사용자 피드백만 담당한다.
       * - SignupForm과 동일한 호출 패턴을 유지한다.
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
        // 행동 유도형 문구로 교체 — 상태 보고 대신 사용자가 다음에 할 일을 즉시 안내
        showToast("메일을 다시 보냈습니다. 받은 편지함을 확인해주세요.");
      }
    } catch (e) {
      // 프로덕션에서 응답 객체 전체가 콘솔에 노출되지 않도록 개발 환경으로 제한
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to resend email:", e);
      }

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
        showToast(RATE_LIMIT_TOAST_MESSAGE, {
          variant: "destructive",
          dedupeKey: "auth-rate-limit",
        });
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
        showToast(GLOBAL_ERROR_MESSAGES[e.type], {
          variant: "destructive",
          dedupeKey: `auth-global-${e.type}`,
        });
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
      showToast(UNKNOWN_ERROR_MESSAGE, {
        variant: "destructive",
        dedupeKey: "auth-unknown-error",
      });
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-6xl md:items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl rounded-3xl md:border bg-background px-6 py-10 md:shadow-sm md:px-10 md:py-12">
        {/* 행동 유도형 구조로 재편 — 상태 보고 대신 사용자가 즉시 다음 행동을 인식할 수 있도록 */}
        <div className="space-y-8">
          {/* 제목 영역 */}
          <div className="space-y-3 text-center">
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              이메일 인증
            </h1>
            <p className="text-base text-muted-foreground md:text-md">
              가입하신 이메일로 인증 링크를 보냈습니다.
            </p>
          </div>

          <form
            aria-label="인증 메일 재발송"
            onSubmit={handleSubmit(onSubmit)}
            className="mx-auto w-full max-w-xl"
          >
            <div className="space-y-6 bg-background px-5 py-6 md:px-7 md:py-7">
              <div className="flex gap-4">
                <Label htmlFor="email" className="text-base shrink-0 min-w-16">
                  이메일
                </Label>

                <div className="flex-1 space-y-2">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email")}
                    className="h-12 rounded-xl"
                  />

                  {errors.email?.message && (
                    <p
                      id="email-error"
                      role="alert"
                      className="text-sm text-destructive"
                    >
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-full"
                disabled={isDisabled}
              >
                {/* 로딩 스피너 추가 — SignupForm 패턴과 일관성 유지, 요청 등록 여부를 즉시 전달 */}
                {isDisabled && (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isDisabled ? "전송 중..." : "인증 메일 재발송"}
              </Button>

              <div className="space-y-1 text-center text-sm text-muted-foreground">
                <p>메일이 오지 않으면 스팸함을 확인해주세요.</p>
                <p>여전히 보이지 않으면 위 버튼으로 다시 보낼 수 있습니다.</p>
              </div>
            </div>
          </form>

          <div className="text-center text-sm text-muted-foreground">
            이미 인증하셨나요?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline underline-offset-4"
            >
              로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
