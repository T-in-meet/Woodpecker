import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

// 1차 삭제 이후 임시 stub 처리. 해당 훅과 라우트(/verify-email)는 추후 단계에서 완전 삭제 예정입니다.
export function useResendVerificationEmailMutation() {
  return {
    mutateAsync: async (_args: { email: string }) => {
      return { code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS };
    },
    isPending: false,
  };
}
