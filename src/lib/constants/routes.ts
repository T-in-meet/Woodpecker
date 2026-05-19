export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  VERIFY_EMAIL: "/verify-email",
  NOTES: "/notes",
  NOTES_NEW: "/notes/new",
  NOTES_TODAY: "/notes/today",
  MYPAGE: "/mypage",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  CALLBACK: "/auth/callback",
  RESET_PASSWORD: "/reset-password",
  FORGOT_PASSWORD: "/forgot-password",
  VERIFY_OTP: "/verify-otp",
  RESEND_EMAIL: "/resend-email",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export function getNoteDetailRoute(noteId: string) {
  return `${ROUTES.NOTES}/${noteId}`;
}

export function getNoteReviewRoute(noteId: string) {
  return `${getNoteDetailRoute(noteId)}/review`;
}
