import { NextRequest } from "next/server";

/**
 * 클라이언트 IP 헤더를 읽는 최소 계약.
 */
type ClientIpHeaderReader = {
  get(name: string): string | null;
};

/**
 * 신뢰 대상으로 사용하는 요청 헤더에서 클라이언트 IP를 추출한다.
 *
 * 현재 Vercel 단독 배포 가정에 따라 다음 우선순위를 사용한다.
 *
 * 1. x-real-ip
 * 2. x-forwarded-for
 *
 * 두 헤더 모두 사용할 수 없으면 fallback 값을 만들지 않고 null을 반환한다.
 *
 * @param headers 요청 헤더 reader
 * @returns 추출한 클라이언트 IP 또는 null
 */
export function extractClientIp(headers: ClientIpHeaderReader): string | null {
  // Vercel이 제공하는 x-real-ip를 우선 사용한다.
  const realIp = headers.get("x-real-ip")?.trim();

  if (realIp) {
    return realIp;
  }

  // x-real-ip가 없으면 x-forwarded-for를 사용한다.
  const forwarded = headers.get("x-forwarded-for")?.trim();

  if (forwarded) {
    return forwarded;
  }

  return null;
}

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
 * 주의:
 * - 이 함수의 "unknown" fallback은 기존 Auth 흐름 호환을 위한 legacy 동작이다.
 * - 새로운 Auth Rate Limit 흐름에서는 trusted IP helper를 사용한다.
 * - Vercel 앞단에 별도 프록시를 두거나 Trusted Proxy를 사용하는 경우
 *   현재 로직은 안전하지 않을 수 있으므로 반드시 재검토해야 한다.
 *
 * @param request NextRequest
 * @returns 클라이언트 IP 또는 "unknown"
 */
export function getClientIp(request: NextRequest): string {
  return extractClientIp(request.headers) ?? "unknown";
}
