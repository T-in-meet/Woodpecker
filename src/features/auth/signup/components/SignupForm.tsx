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

export type FormInput = z.input<typeof signupFormSchema>;
type FormValues = z.infer<typeof signupFormSchema>;
type SubmitPayload = Omit<FormValues, "confirmPassword">;

type SignupFormProps = {
  onSubmit: (values: SubmitPayload) => void | Promise<void>;
  isPending?: boolean;
};

export function SignupForm({ onSubmit, isPending = false }: SignupFormProps) {
  const [globalErrorMessage, setGlobalErrorMessage] = useState<string | null>(
    null,
  );
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

  const { onChange: onPasswordChange, ...passwordRegister } =
    register("password");
  const { onChange: onConfirmChange, ...confirmPasswordRegister } =
    register("confirmPassword");

  const handleValidSubmit = async (data: FormValues) => {
    const { confirmPassword: _, ...payload } = data;
    clearErrors();
    setGlobalErrorMessage(null);

    try {
      await onSubmit(payload);
    } catch (e: unknown) {
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

        if (hasUnknownField) {
          setError("root", { message: "요청을 처리할 수 없습니다" });
        }

        return;
      }

      if (isGlobalError(e)) {
        setGlobalErrorMessage(GLOBAL_ERROR_MESSAGES[e.type]);
      }
    }
  };

  const handlePasswordChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await onPasswordChange(e);
      if (getValues("confirmPassword")) {
        await trigger("confirmPassword");
      }
    },
    [onPasswordChange, getValues, trigger],
  );

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
            setValue("avatarFile", file, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
        />
      </div>

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

      {globalErrorMessage && (
        <Toast message={globalErrorMessage} variant="destructive" />
      )}

      {errors.root && (
        <p role="alert" data-testid="form-error" className="text-red-500">
          {errors.root.message}
        </p>
      )}

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
