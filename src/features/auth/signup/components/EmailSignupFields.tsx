"use client";

import type { ChangeEvent } from "react";
import type { FieldErrors, UseFormRegisterReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      {/* 닉네임 */}
      <div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[6.25rem_minmax(0,1fr)]">
          <div className="flex items-center">
            <Label htmlFor="nickname" className="shrink-0 min-w-25">
              닉네임
            </Label>
          </div>
          <Input
            id="nickname"
            type="text"
            placeholder="닉네임을 입력하세요"
            {...nicknameRegister}
          />
          <div />
          <div className="min-h-5 mt-2">
            {errors.nickname && (
              <p role="alert" className="text-sm text-destructive">
                {errors.nickname.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 이메일 */}
      <div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[6.25rem_minmax(0,1fr)]">
          <div className="flex items-center">
            <Label htmlFor="email" className="shrink-0 min-w-25">
              이메일
            </Label>
          </div>
          <Input
            id="email"
            type="email"
            placeholder="example@email.com"
            {...emailRegister}
          />
          <div />
          <div className="min-h-5 mt-2">
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
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[6.25rem_minmax(0,1fr)]">
          <div className="flex items-center">
            <Label htmlFor="password" className="shrink-0 min-w-25">
              비밀번호
            </Label>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="8자 이상 입력하세요"
            {...passwordRegister}
            onChange={onPasswordChange}
          />
          <div />
          <div className="min-h-5 mt-2">
            {errors.password && (
              <p role="alert" className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 비밀번호 확인 */}
      <div>
        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[6.25rem_minmax(0,1fr)]">
          <div className="flex items-center">
            <Label htmlFor="confirmPassword" className="shrink-0 min-w-25">
              비밀번호 확인
            </Label>
          </div>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            {...confirmPasswordRegister}
            onChange={onConfirmPasswordChange}
          />
          <div />
          <div className="min-h-5 mt-2">
            {errors.confirmPassword && (
              <p role="alert" className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
