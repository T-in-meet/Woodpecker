"use client";

/**
 * 이메일 인증 안내 페이지 클라이언트 컴포넌트
 *
 * 설계 의도:
 * - 회원가입 완료 후 이메일 인증을 유도하는 단일 진입점 역할을 한다.
 * - 인증 메일 재발송 기능을 제공하며, 남용 방지를 위해 쿨다운과 rate limit을 처리한다.
 * - auth-rules.md 정책에 따라 회원 상태(신규/미인증/인증)를 프론트에서 구분하지 않는다.
 *   → 서버 응답 코드나 상태로 계정 상태를 추론할 수 없도록 동일한 UX 흐름을 유지한다.
 *
 * 쿨다운 로직:
 * - 재발송 성공(200) 또는 이미 쿨다운 중(409) 응답 시 60초 타이머를 시작한다.
 * - 타이머가 활성화된 동안에는 버튼이 비활성화되어 중복 요청을 방지한다.
 * - useEffect는 cooldown 값이 변경될 때마다 1초 간격의 인터벌을 갱신하며,
 *   cleanup 함수로 이전 인터벌을 정리해 메모리 누수를 방지한다.
 *
 * rate limit 처리:
 * - 429 응답 시 쿨다운 타이머 대신 에러 메시지를 표시한다.
 * - 쿨다운과 rate limit은 서로 다른 UX로 분리되어 있다.
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

type FormValues = {
  email: string;
};

// 재발송 후 다음 요청까지 대기해야 하는 초 단위 쿨다운 시간
const COOLDOWN_SECONDS = 60;

type Props = {
  // 이전 단계(회원가입)에서 전달받은 이메일을 input에 pre-fill하기 위해 사용한다.
  // searchParams를 통해 전달되며, 없으면 빈 입력 상태로 시작한다.
  email?: string | undefined;
};

export default function VerifyEmailPageClient({ email }: Props) {
  const [cooldown, setCooldown] = useState(0);
  const [rateLimitError, setRateLimitError] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    values: { email: email ?? "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const isCoolingDown = cooldown > 0;
  const isDisabled = isSubmitting || isCoolingDown;

  const onSubmit = async (values: FormValues) => {
    // 재시도 시 이전 rate limit 에러 메시지를 초기화한다.
    setRateLimitError(false);

    try {
      const res = await fetch("/api/auth/resend-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      const body = (await res.json()) as { code: string };

      // 429: 서버 측 rate limit 초과 — 쿨다운이 아닌 에러 메시지로 구분한다.
      if (res.status === 429) {
        setRateLimitError(true);
        return;
      }

      // 200(재발송 성공) 또는 409(이미 발송된 메일이 쿨다운 중) 모두 쿨다운 타이머를 시작한다.
      // 409는 서버에서 이미 쿨다운이 진행 중임을 의미하므로 프론트도 동일하게 동기화한다.
      if (
        res.status === 409 ||
        body.code === AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS
      ) {
        setCooldown(COOLDOWN_SECONDS);
      }
    } catch (error) {
      // 네트워크 오류 등에 대한 Fallback 처리 (ex: toast알림 띄우기)
      console.error("Failed to resend email:", error);
      // TODO: 사용자에게 "일시적인 오류가 발생했습니다" 피드백 제공
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

          {rateLimitError && (
            <p role="alert" className="text-sm text-destructive">
              요청 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isDisabled}>
            {isCoolingDown
              ? `인증 메일 재발송 (${cooldown}초)`
              : "인증 메일 재발송"}
          </Button>
        </form>
      </div>
    </div>
  );
}
