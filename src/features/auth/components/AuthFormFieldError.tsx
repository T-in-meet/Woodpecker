"use client";

type AuthFormFieldErrorProps = {
  error?: string | undefined;
};

/**
 * Auth 입력 필드의 validation error 영역을 표시합니다.
 *
 * 에러 유무와 관계없이 최소 높이를 유지해
 * 필드 간 layout shift를 줄입니다.
 */
export const AuthFormFieldError = ({ error }: AuthFormFieldErrorProps) => {
  return (
    <div className="mt-2 min-h-5">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default AuthFormFieldError;
