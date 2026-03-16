export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  DASHBOARD: "/dashboard",
  RECORDS: "/records",
  RECORDS_NEW: "/records/new",
  MYPAGE: "/mypage",
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];
