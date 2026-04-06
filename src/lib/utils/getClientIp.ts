import { NextRequest } from "next/server";

/**
 * 요청에서 신뢰할 수 있는 클라이언트 IP를 추출한다.
 *
 * Vercel 환경 기준: 두 헤더 모두 단일 클라이언트 IP를 제공한다고 가정한다.
 *
 * 헤더 우선순위:
 * 1. x-real-ip       — 존재하면 trim 후 반환
 * 2. x-forwarded-for — trim 후 그대로 반환
 * 3. "unknown"       — 둘 다 없거나 빈 문자열인 경우
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  if (forwarded) return forwarded;

  return "unknown";
}
