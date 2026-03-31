"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupFormSchema } from "@/lib/validation/auth/signupSchema";

type FormInput = z.input<typeof signupFormSchema>;
type FormValues = z.infer<typeof signupFormSchema>;
type SubmitPayload = Omit<FormValues, "confirmPassword">;

export function SignupForm() {
  const { mutate, isPending } = useMutation<void, Error, SubmitPayload>({
    mutationFn: async (_data) => {
      // TODO: API call
    },
  });

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    trigger,
    getValues,
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

  const onSubmit = (data: FormValues) => {
    const { confirmPassword: _, ...payload } = data;
    mutate(payload);
  };

  return (
    <form
      aria-label="회원가입"
      className="mx-auto mt-20 max-w-5xl space-y-4 pl-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="space-y-4">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register("email")} />
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
          {...passwordRegister}
          onChange={async (e) => {
            await onPasswordChange(e);
            if (getValues("confirmPassword")) {
              await trigger("confirmPassword");
            }
          }}
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
          {...confirmPasswordRegister}
          onChange={(e) => {
            void onConfirmChange(e).then(() => {
              void trigger("confirmPassword");
            });
          }}
        />
        {errors.confirmPassword && (
          <p role="alert" className="text-red-500">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <Label htmlFor="nickname">닉네임</Label>
        <Input id="nickname" type="text" {...register("nickname")} />
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
          accept="image/jpeg,image/png,image/webp"
          {...register("avatarFile")}
        />
      </div>

      <div className="flex justify-between">
        {/* 이용약관 */}
        <div data-testid="terms-of-service-field" className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-blue-400 text-white"
            >
              이용약관 보기
            </Button>

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
                    errors.termsOfService ? "terms-of-service-error" : undefined
                  }
                />
              )}
            />
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
        <div data-testid="privacy-policy-field" className="flex-1 space-y-2">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="bg-blue-400 text-white"
            >
              개인정보처리방침 보기
            </Button>

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

          {errors.privacyPolicy && (
            <p id="privacy-policy-error" role="alert" className="text-red-500">
              {errors.privacyPolicy.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-between">
        <Link href="/login" className="text-blue-400 hover:text-blue-500">
          이미 가입하셨나요?
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending && <span role="status" aria-label="로딩 중" />}
          회원가입
        </Button>
      </div>
    </form>
  );
}
