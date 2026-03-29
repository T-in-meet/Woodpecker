export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  NOTES: "/notes",
  NOTES_NEW: "/notes/new",
  MYPAGE: "/mypage",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  VERIFY_EMAIL: "/verify-email",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
