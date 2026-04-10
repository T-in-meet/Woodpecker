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
 * rate limit 처리:
 * - auth-rules 스펙에 따라 클라이언트 측에서 쿨다운 타이머나 남은 시간을 추적하지 않는다.
 * - 오직 서버의 상태(429)에 따라 이벤트 기반의 전역 토스트 메시지(showToast)로만 피드백한다.
 */

import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { showToast } from "@/lib/utils/showToast";

type FormValues = {
  email: string;
};

const RATE_LIMIT_TOAST_MESSAGE =
  "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";

type Props = {
  // 이전 단계(회원가입)에서 전달받은 이메일을 input에 pre-fill하기 위해 사용한다.
  // searchParams를 통해 전달되며, 없으면 빈 입력 상태로 시작한다.
  email?: string | undefined;
};

export default function VerifyEmailPageClient({ email }: Props) {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    values: { email: email ?? "" },
  });

  const isDisabled = isSubmitting;

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await fetch("/api/auth/resend-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      const body = (await res.json()) as { code: string };

      if (res.status === 429) {
        showToast(RATE_LIMIT_TOAST_MESSAGE, "destructive");
        return;
      }

      if (body.code === AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS) {
        showToast("인증 메일이 재발송되었습니다.");
      }
    } catch (error) {
      console.error("Failed to resend email:", error);
      showToast("일시적인 오류가 발생했습니다.", "destructive");
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
