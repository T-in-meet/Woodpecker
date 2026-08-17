// trailing slash 정규화로 sitemap/URL 조합 시 `//path` 방지
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://woodpecker-blue.vercel.app"
).replace(/\/$/, "");
