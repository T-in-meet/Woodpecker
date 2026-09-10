"use client";

type AuthFormErrorProps = {
  error?: string | undefined;
};

/**
 * Auth 폼 전체에 해당하는 root error를 표시합니다.
 *
 * 에러 유무와 관계없이 최소 높이를 유지해 layout shift를 줄이며,
 * 필드 단위 에러는 AuthFormFieldError에서 처리합니다.
 */
export const AuthFormError = ({ error }: AuthFormErrorProps) => {
  return (
    <div className="min-h-5">
      {error ? (
        <p
          role="alert"
          data-testid="form-error"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
};

export default AuthFormError;
