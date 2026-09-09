import { Label } from "@/components/ui/label";
import { AuthFormFieldError } from "@/features/auth/components/AuthFormFieldError";

type AuthFormFieldProps = {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: React.ReactNode;
};

/**
 * 일반 Auth 입력 필드의 Label, Input, Error 배치를 통일합니다.
 *
 * 기존 Auth 필드 구조를 기준으로 공통화합니다.
 * 참고:
 * - auth/login/components/LoginForm.tsx
 * - auth/signup/components/EmailSignupFields.tsx
 * - auth/reset-password/components/ResetPasswordForm.tsx
 * - auth/set-password/components/SetPasswordForm.tsx
 *
 * 모바일:
 * Label
 * Input
 * Error
 *
 * auth breakpoint 이상:
 * Label | Input
 *       | Error
 *
 * 실제 input 요소와 React Hook Form 연결은 children으로 전달하며,
 * 이 컴포넌트는 입력 동작이나 validation 로직을 담당하지 않습니다.
 */
export function AuthFormField({
  label,
  htmlFor,
  error,
  children,
}: AuthFormFieldProps) {
  return (
    <div className="grid grid-cols-1 gap-x-4 auth:grid-cols-[6.25rem_minmax(0,1fr)]">
      <div className="mb-2 flex items-center auth:mb-0">
        <Label htmlFor={htmlFor} className="min-w-25 shrink-0">
          {label}
        </Label>
      </div>

      <div className="min-w-0">{children}</div>

      {/* auth 이상에서는 Error가 Input 아래 두 번째 열에 오도록 빈 첫 번째 열을 유지한다. */}
      <div className="hidden auth:block" aria-hidden="true" />

      <AuthFormFieldError error={error} />
    </div>
  );
}
