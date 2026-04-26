// NEXT_PUBLIC_SITE_URL이 있으면 우선 사용 — Vercel preview 배포 등 환경별 URL 대응
// trailing slash 정규화로 sitemap/URL 조합 시 `//path` 방지
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://woodpecker-app.vercel.app"
).replace(/\/$/, "");
