// trailing slash 정규화로 sitemap/URL 조합 시 `//path` 방지
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://woodpecker-blue.vercel.app"
).replace(/\/$/, "");

export const SITE_NAME = "딱다구리";
export const SITE_TITLE = "딱다구리 — 기록이 기억이 되는 간격 반복 학습 공간";
