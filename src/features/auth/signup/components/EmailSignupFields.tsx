"use client";

import type { ChangeEvent } from "react";
import type { FieldErrors, UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { AuthFormField } from "@/features/auth/components/AuthFormField";
import { PasswordInput } from "@/features/auth/components/PasswordInput";

import type { FormInput } from "./SignupForm";

/**
 * 이메일 회원가입 입력 필드 props
 */
type EmailSignupFieldsProps = {
  errors: Pick<
    FieldErrors<FormInput>,
    "nickname" | "email" | "password" | "confirmPassword"
  >;
  nicknameRegister: UseFormRegisterReturn<"nickname">;
  emailRegister: UseFormRegisterReturn<"email">;
  passwordRegister: Omit<UseFormRegisterReturn<"password">, "onChange">;
  confirmPasswordRegister: Omit<
    UseFormRegisterReturn<"confirmPassword">,
    "onChange"
  >;
  onPasswordChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onConfirmPasswordChange: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
};

/**
 * 이메일 회원가입에 필요한 입력 필드 묶음
 *
 * 일반 Auth 입력 필드는 AuthFormField를 사용하고,
 * 비밀번호 필드는 표시 여부를 전환할 수 있는 PasswordInput을 사용합니다.
 *
 * 각 필드의 React Hook Form 등록 및 validation 동작은 이 컴포넌트에서
 * 기존과 동일하게 유지합니다.
 */
export function EmailSignupFields({
  errors,
  nicknameRegister,
  emailRegister,
  passwordRegister,
  confirmPasswordRegister,
  onPasswordChange,
  onConfirmPasswordChange,
}: EmailSignupFieldsProps) {
  return (
    <div className="space-y-2">
      <AuthFormField
        label="닉네임"
        htmlFor="nickname"
        error={errors.nickname?.message}
      >
        <Input
          id="nickname"
          type="text"
          placeholder="닉네임을 입력하세요"
          {...nicknameRegister}
        />
      </AuthFormField>

      <AuthFormField
        label="이메일"
        htmlFor="email"
        error={errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          placeholder="example@email.com"
          {...emailRegister}
        />
      </AuthFormField>

      <AuthFormField
        label="비밀번호"
        htmlFor="password"
        error={errors.password?.message}
      >
        <PasswordInput
          id="password"
          placeholder="8자 이상 입력하세요"
          {...passwordRegister}
          onChange={onPasswordChange}
        />
      </AuthFormField>

      <AuthFormField
        label="비밀번호 확인"
        htmlFor="confirmPassword"
        error={errors.confirmPassword?.message}
      >
        <PasswordInput
          id="confirmPassword"
          placeholder="비밀번호를 다시 입력하세요"
          {...confirmPasswordRegister}
          onChange={onConfirmPasswordChange}
        />
      </AuthFormField>
    </div>
  );
}
