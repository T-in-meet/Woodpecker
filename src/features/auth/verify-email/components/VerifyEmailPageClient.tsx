"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

type FormValues = {
  email: string;
};

const COOLDOWN_SECONDS = 60;

type Props = {
  email?: string;
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
    setRateLimitError(false);

    try {
      const res = await fetch("/api/auth/resend-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });

      const body = (await res.json()) as { code: string };

      if (res.status === 429) {
        setRateLimitError(true);
        return;
      }

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
