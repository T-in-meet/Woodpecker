"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { resolveFieldName } from "@/features/auth/lib/resolveFieldName";
import { useLoginMutation } from "@/features/auth/login/hooks/useLoginMutation";
import { loginFormSchema } from "@/features/auth/login/schema/loginFormSchema";
import { LOGIN_FIELD_SET } from "@/features/auth/login/types/form.types";
import { showToast } from "@/lib/utils/showToast";
import { isServerValidationError } from "@/lib/validation/isServerValidationError";
import { mapReasonToMessage } from "@/lib/validation/mapReasonToMessage";

type FormValues = {
  email: string;
  password: string;
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<FormValues>({
    resolver: zodResolver(loginFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { email: "", password: "" },
  });

  const clearRootError = () => {
    if (errors.root) {
      clearErrors("root");
    }
  };

  const handleValidSubmit = async (data: FormValues) => {
    clearErrors();

    const redirectParam = searchParams.get("redirect");

    try {
      // exactOptionalPropertyTypes: redirectTo가 없을 때는 키 자체를 제외해야 함
      const result = await mutateAsync(
        redirectParam
          ? { payload: data, redirect: redirectParam }
          : { payload: data },
      );

      // 로그인 성공 후 서버 상태 동기화 — 세션/유저/마이페이지 캐시를 무효화해 최신 상태 보장
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "user"] });
      await queryClient.invalidateQueries({ queryKey: ["mypage"] });

      router.push(result.data.redirectTo);
    } catch (e: unknown) {
      // 서버 validation 에러 — 필드 단위로 매핑
      if (isServerValidationError(e)) {
        let hasUnknownField = false;

        for (const { field, reason } of e.data.errors) {
          const fieldName = resolveFieldName(field, LOGIN_FIELD_SET);
          const message = mapReasonToMessage(reason);

          if (fieldName !== null) {
            setError(fieldName, { message });
          } else {
            hasUnknownField = true;
          }
        }

        if (hasUnknownField) {
          setError("root", { message: "요청을 처리할 수 없습니다" });
        }
        return;
      }

      // 인증 실패 — 계정 존재 여부를 외부에 노출하지 않기 위해 단일 메시지 사용
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        e.code === AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS
      ) {
        setError("root", {
          message: "이메일 또는 비밀번호가 올바르지 않습니다.",
        });
        return;
      }

      // rate limit — 토스트로 안내
      if (isRateLimitError(e)) {
        showToast(RATE_LIMIT_TOAST_MESSAGE, "destructive");
        return;
      }

      // 네트워크/서버/타임아웃 에러 — 토스트로 안내
      if (isGlobalError(e)) {
        showToast(GLOBAL_ERROR_MESSAGES[e.type], "destructive");
        return;
      }

      // 그 외 예상하지 못한 에러 — 최소한의 피드백 보장
      showToast(UNKNOWN_ERROR_MESSAGE, "destructive");
    }
  };

  return (
    <div className="mx-auto my-0 max-w-md overflow-hidden rounded-none border-0 bg-white shadow-none md:my-8 md:rounded-xl md:border md:border-outline-variant md:shadow-sm">
      <form
        aria-label="로그인"
        className="mx-auto max-w-4xl space-y-4 px-4 py-8 md:px-8"
        onSubmit={handleSubmit(handleValidSubmit)}
        noValidate
      >
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-primary">
          로그인
        </h1>

        {/* 이메일 */}
        <div>
          <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
            <div className="flex items-center">
              <Label htmlFor="email" className="min-w-25 shrink-0">
                이메일
              </Label>
            </div>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="example@email.com"
              {...register("email", {
                onChange: clearRootError,
              })}
            />
            <div />
            {/* 에러 영역을 고정 높이로 유지 — 레이아웃 흔들림 방지 */}
            <div className="mt-2 min-h-5">
              {errors.email && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 비밀번호 */}
        <div>
          <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-x-4">
            <div className="flex items-center">
              <Label htmlFor="password" className="min-w-25 shrink-0">
                비밀번호
              </Label>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력하세요"
              {...register("password", {
                onChange: clearRootError,
              })}
            />
            <div />
            {/* 에러 영역을 고정 높이로 유지 — 레이아웃 흔들림 방지 */}
            <div className="mt-2 min-h-5">
              {errors.password && (
                <p role="alert" className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 인증 실패 / 서버 에러 */}
        <div className="min-h-5">
          {errors.root && (
            <p
              role="alert"
              data-testid="form-error"
              className="text-sm text-destructive"
            >
              {errors.root.message}
            </p>
          )}
        </div>

        {/* 액션 영역 */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            비밀번호 찾기
          </Link>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto"
          >
            {isPending && (
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {isPending ? "로그인 중..." : "로그인"}
          </Button>
        </div>
      </form>
    </div>
  );
}
