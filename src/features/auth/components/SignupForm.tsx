"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const signupFormSchema = z
  .object({
    email: z.string().email("올바른 이메일을 입력해주세요"),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string(),
    nickname: z.preprocess(
      (val) => (typeof val === "string" ? val.trim() : val),
      z
        .string()
        .min(1, "닉네임은 1자 이상이어야 합니다")
        .max(10, "닉네임은 10자 이내로 입력해주세요"),
    ),
    termsOfService: z.boolean().refine((val) => val === true, {
      message: "이용약관에 동의해주세요",
    }),
    privacyPolicy: z.boolean().refine((val) => val === true, {
      message: "개인정보 처리방침에 동의해주세요",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

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
          onChange={(e) => {
            void onPasswordChange(e).then(() => {
              if (getValues("confirmPassword")) {
                void trigger("confirmPassword");
              }
            });
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
          name="avatarFile"
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </div>

      <div className="flex justify-between">
        <div className="flex-1 space-y-4">
          <input
            id="termsOfService"
            type="checkbox"
            {...register("termsOfService")}
          />
          <Label htmlFor="termsOfService">이용약관에 동의합니다</Label>
          <Button type="button" variant="ghost" size="sm">
            이용약관 보기
          </Button>
          {errors.termsOfService && (
            <p role="alert" className="text-red-500">
              {errors.termsOfService.message}
            </p>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <input
            id="privacyPolicy"
            type="checkbox"
            {...register("privacyPolicy")}
          />
          <Label htmlFor="privacyPolicy">개인정보 처리방침에 동의합니다</Label>
          <Button type="button" variant="ghost" size="sm">
            개인정보처리방침 보기
          </Button>
          {errors.privacyPolicy && (
            <p role="alert" className="text-red-500">
              {errors.privacyPolicy.message}
            </p>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending && <span role="status" aria-label="로딩 중" />}
        회원가입
      </Button>
    </form>
  );
}
