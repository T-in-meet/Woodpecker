export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  VERIFY_EMAIL: "/verify-email",
  NOTES: "/notes",
  NOTES_NEW: "/notes/new",
  MYPAGE: "/mypage",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  CALLBACK: "/auth/callback",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export function getNoteDetailRoute(noteId: string) {
  return `${ROUTES.NOTES}/${noteId}`;
}

export function getNoteReviewRoute(noteId: string) {
  return `${getNoteDetailRoute(noteId)}/review`;
}
