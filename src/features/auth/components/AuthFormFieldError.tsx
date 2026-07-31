"use client";

type AuthFormFieldErrorProps = {
  error: { message?: string } | undefined;
};

/**
 * 에러 영역을 고정 높이로 유지 — 레이아웃 흔들림 방지
 */
export const AuthFormFieldError = ({ error }: AuthFormFieldErrorProps) => {
  return (
    <div className="mt-2 min-h-5">
      {error?.message && (
        <p role="alert" className="text-sm text-destructive pl-3">
          {error.message}
        </p>
      )}
    </div>
  );
};

export default AuthFormFieldError;
