"use client";

type AuthenticationErrorProps = {
  error:
    | {
        message?: string;
      }
    | undefined;
};

const AuthenticationError = ({ error }: AuthenticationErrorProps) => {
  return (
    <div className="min-h-5">
      {error?.message && (
        <p
          role="alert"
          data-testid="form-error"
          className="text-sm text-destructive text-center"
        >
          {error.message}
        </p>
      )}
    </div>
  );
};

export default AuthenticationError;
