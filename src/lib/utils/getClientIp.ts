import { NextRequest } from "next/server";

/**
 * 요청 헤더에서 클라이언트 IP를 추출한다.
 *
 * 생성 이유 (보안 관점):
 * - x-forwarded-for 같은 프록시 헤더는 환경에 따라 조작 가능성이 있음
 * - route에서 직접 헤더를 읽으면 잘못된 방식으로 사용할 위험이 있음
 * - 따라서 IP 추출 로직을 한 곳으로 모아 신뢰 기준을 통제하기 위해 생성
 *
 * 운영 환경 가정:
 * - 현재 프로젝트는 Vercel 단독 배포를 기준으로 한다
 * - x-real-ip / x-forwarded-for는 Vercel Edge가 주입한 값으로 간주한다
 * - 외부에서 전달된 X-Forwarded-For는 Vercel에서 overwrite된다고 가정한다
 *
 * 처리 방식:
 * - 프록시 체인 파싱(split, 마지막 값 선택 등)은 수행하지 않는다
 * - 환경 가정 하에서 단일 IP로 간주하고 그대로 사용한다
 *
 * 우선순위:
 * 1. x-real-ip
 * 2. x-forwarded-for
 * 3. "unknown"
 *
 * ⚠️ 중요:
 * - Vercel 앞단에 별도 프록시를 두거나 Trusted Proxy를 사용하는 경우
 *   현재 로직은 안전하지 않을 수 있으므로 반드시 재검토해야 한다
 *
 * @param request NextRequest
 * @returns 클라이언트 IP 또는 "unknown"
 */
export function getClientIp(request: NextRequest): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = request.headers.get("x-forwarded-for")?.trim();
  if (forwarded) return forwarded;

  return "unknown";
}
