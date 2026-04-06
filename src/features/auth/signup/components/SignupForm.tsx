"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { signupFormSchema } from "@/features/auth/signup/schema/schema";
import { cn } from "@/lib/utils/cn";

import { GLOBAL_ERROR_MESSAGES, isGlobalError } from "../../errors/globalError";
import { isServerValidationError } from "../../lib/isServerValidationError";
import { resolveFieldName } from "../../lib/resolveFieldName";
import { mapReasonToMessage } from "../lib/mapReasonToMessage";

/**
 * 폼 입력 타입 (raw input 기준)
 * - nullable / optional 상태 포함
 */
export type FormInput = z.input<typeof signupFormSchema>;

/**
 * validation 이후 확정된 값 타입
 */
type FormValues = z.infer<typeof signupFormSchema>;

/**
 * API로 전달되는 payload
 * - confirmPassword는 서버로 보내지 않음
 */
type SubmitPayload = Omit<FormValues, "confirmPassword">;

/**
 * SignupForm Props
 * - onSubmit: 상위에서 API 호출 담당
 * - isPending: 요청 상태 (중복 제출 방지 / UI 제어)
 */
type SignupFormProps = {
  onSubmit: (values: SubmitPayload) => void | Promise<void>;
  isPending?: boolean;
};

/**
 * 회원가입 폼 컴포넌트
 *
 * 책임:
 * - 입력 UI
 * - validation (RHF + Zod)
 * - 에러 처리 (field / global)
 *
 * 비책임:
 * - API 호출
 * - 라우팅
 */
export function SignupForm({ onSubmit, isPending = false }: SignupFormProps) {
  /**
   * 글로벌 에러 메시지 (네트워크 / 서버 등)
   */
  const [globalErrorMessage, setGlobalErrorMessage] = useState<string | null>(
    null,
  );

  /**
   * react-hook-form 설정
   */
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
    setValue,
    setError,
    clearErrors,
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      nickname: "",
      termsOfService: false,
      privacyPolicy: false,
    },
  });

  /**
   * password / confirmPassword 분리
   * - onChange 커스터마이징 위해
   */
  const { onChange: onPasswordChange, ...passwordRegister } =
    register("password");
  const { onChange: onConfirmChange, ...confirmPasswordRegister } =
    register("confirmPassword");

  /**
   * 유효한 폼 제출 시 실행
   */
  const handleValidSubmit = async (data: FormValues) => {
    /**
     * confirmPassword 제거
     */
    const { confirmPassword: _, ...payload } = data;

    /**
     * 기존 에러 초기화
     */
    clearErrors();
    setGlobalErrorMessage(null);

    try {
      /**
       * 실제 API 호출은 상위에서 수행
       */
      await onSubmit(payload);
    } catch (e: unknown) {
      /**
       * 서버 validation 에러 처리
       */
      if (isServerValidationError(e)) {
        let hasUnknownField = false;

        for (const { field, reason } of e.data.errors) {
          const fieldName = resolveFieldName(field);
          const message = mapReasonToMessage(reason);

          if (fieldName !== null) {
            setError(fieldName, { message });
          } else {
            hasUnknownField = true;
          }
        }

        /**
         * 매핑 불가능한 필드 존재 시 root 에러
         */
        if (hasUnknownField) {
          setError("root", { message: "요청을 처리할 수 없습니다" });
        }

        return;
      }

      /**
       * 글로벌 에러 처리 (network, timeout 등)
       */
      if (isGlobalError(e)) {
        setGlobalErrorMessage(GLOBAL_ERROR_MESSAGES[e.type]);
      }
    }
  };

  /**
   * password 변경 시 confirmPassword 재검증
   */
  const handlePasswordChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await onPasswordChange(e);

      if (getValues("confirmPassword")) {
        await trigger("confirmPassword");
      }
    },
    [onPasswordChange, getValues, trigger],
  );

  /**
   * confirmPassword 변경 시 즉시 검증
   */
  const handleConfirmPasswordChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await onConfirmChange(e);
      await trigger("confirmPassword");
    },
    [onConfirmChange, trigger],
  );

  return (
    <form
      aria-label="회원가입"
      className="mx-auto max-w-4xl space-y-4 mt-16 px-4"
      onSubmit={handleSubmit(handleValidSubmit)}
    >
      {/* 이메일 */}
      <div className="space-y-4">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          {...register("email")}
          className={cn(!errors.email && "mb-14")}
        />
        {errors.email && (
          <p role="alert" className="text-red-500">
            {errors.email.message}
          </p>
        )}
      </div>

      {/* 비밀번호 */}
      <div className="space-y-4">
        <Label htmlFor="password">비밀번호</Label>
        <Input
          id="password"
          type="password"
          className={cn(!errors.password && "mb-14")}
          {...passwordRegister}
          onChange={handlePasswordChange}
        />
        {errors.password && (
          <p role="alert" className="text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>

      {/* 비밀번호 확인 */}
      <div className="space-y-4">
        <Label htmlFor="confirmPassword">비밀번호 확인</Label>
        <Input
          id="confirmPassword"
          type="password"
          className={cn(!errors.confirmPassword && "mb-14")}
          {...confirmPasswordRegister}
          onChange={handleConfirmPasswordChange}
        />
        {errors.confirmPassword && (
          <p role="alert" className="text-red-500">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      {/* 닉네임 */}
      <div className="space-y-4">
        <Label htmlFor="nickname">닉네임</Label>
        <Input
          id="nickname"
          type="text"
          className={cn(!errors.nickname && "mb-14")}
          {...register("nickname")}
        />
        {errors.nickname && (
          <p role="alert" className="text-red-500">
            {errors.nickname.message}
          </p>
        )}
      </div>

      {/* 프로필 이미지 */}
      <div className="space-y-4">
        <Label htmlFor="avatarFile">
          프로필 사진 <span>(선택)</span>
        </Label>
        <Input
          id="avatarFile"
          type="file"
          className={cn(!errors.avatarFile && "mb-14")}
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;

            /**
             * RHF에 파일 수동 등록
             */
            setValue("avatarFile", file, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
      </div>

      {/* 약관 */}
      <div
        data-testid="agreements-container"
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* 이용약관 */}
        <div data-testid="terms-of-service-field" className="space-y-2">
          <div
            data-testid="tos-inner-row"
            className={cn(
              "flex flex-col lg:flex-row lg:items-center gap-2",
              !errors.termsOfService && "mb-8",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-blue-400 text-white"
            >
              이용약관 보기
            </Button>

            <div
              data-testid="tos-text-checkbox-group"
              className="flex items-center gap-2"
            >
              <Label htmlFor="termsOfService">이용약관에 동의합니다</Label>

              <Controller
                name="termsOfService"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="termsOfService"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                    }}
                    onBlur={field.onBlur}
                    aria-describedby={
                      errors.termsOfService
                        ? "terms-of-service-error"
                        : undefined
                    }
                  />
                )}
              />
            </div>
          </div>

          {errors.termsOfService && (
            <p
              id="terms-of-service-error"
              role="alert"
              className="text-red-500"
            >
              {errors.termsOfService.message}
            </p>
          )}
        </div>

        {/* 개인정보 */}
        <div data-testid="privacy-policy-field" className="space-y-2">
          <div
            className={cn(
              "flex flex-col lg:flex-row lg:items-center gap-2",
              !errors.privacyPolicy && "mb-8",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-blue-400 text-white"
            >
              개인정보처리방침 보기
            </Button>

            <div className="flex items-center gap-2">
              <Label htmlFor="privacyPolicy">
                개인정보 처리방침에 동의합니다
              </Label>

              <Controller
                name="privacyPolicy"
                control={control}
                render={({ field }) => (
                  <Checkbox
                    id="privacyPolicy"
                    name={field.name}
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked === true);
                    }}
                    onBlur={field.onBlur}
                    aria-describedby={
                      errors.privacyPolicy ? "privacy-policy-error" : undefined
                    }
                  />
                )}
              />
            </div>
          </div>

          {errors.privacyPolicy && (
            <p id="privacy-policy-error" role="alert" className="text-red-500">
              {errors.privacyPolicy.message}
            </p>
          )}
        </div>
      </div>

      {/* 글로벌 에러 */}
      {globalErrorMessage && (
        <Toast message={globalErrorMessage} variant="destructive" />
      )}

      {/* root 에러 */}
      {errors.root && (
        <p role="alert" data-testid="form-error" className="text-red-500">
          {errors.root.message}
        </p>
      )}

      {/* 액션 영역 */}
      <div
        data-testid="form-action-area"
        className="flex flex-wrap justify-between gap-2"
      >
        <Link href="/login" className="text-blue-400 hover:text-blue-500">
          이미 가입하셨나요?
        </Link>

        <Button type="submit" disabled={isPending}>
          {isPending && <span role="status" aria-label="로딩 중" />}
          {isPending ? "가입 중..." : "회원가입"}
        </Button>
      </div>
    </form>
  );
}
