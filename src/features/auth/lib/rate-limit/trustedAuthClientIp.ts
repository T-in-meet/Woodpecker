import { headers } from "next/headers";
import type { NextRequest } from "next/server";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import { extractClientIp } from "@/lib/utils/getClientIp";

/**
 * Development/Test에서 trusted IP 헤더가 없을 때 사용하는 로컬 fallback.
 *
 * Vercel Preview/Production에서는 이 fallback을 사용하지 않는다.
 */
const LOCAL_CLIENT_IP_FALLBACK = "127.0.0.1";

/**
 * Auth Rate Limit에서 사용하는 trusted 사용자 IP 확인 결과.
 *
 * Vercel Preview/Production에서는 trusted IP 확보 실패를 명시적인
 * IP_UNAVAILABLE 상태로 반환한다.
 */
export type TrustedAuthClientIpResult =
  | {
      available: true;
      ip: string;
    }
  | {
      available: false;
      reasonCode: typeof AUTH_LOG_REASONS.IP_UNAVAILABLE;
    };

/**
 * 추출된 사용자 IP에 배포 환경 fail-closed 정책을 적용한다.
 *
 * Vercel Preview/Production:
 * - `NODE_ENV`가 `production`이므로 동일한 fail-closed 정책을 적용한다.
 * - IP가 있으면 사용한다.
 * - IP가 없으면 IP_UNAVAILABLE을 반환한다.
 *
 * Development/Test:
 * - IP가 있으면 사용한다.
 * - IP가 없으면 로컬 fallback을 사용한다.
 *
 * @param extractedIp 요청 헤더에서 추출한 IP
 * @returns trusted 사용자 IP 확인 결과
 */
function resolveTrustedAuthClientIp(
  extractedIp: string | null,
): TrustedAuthClientIpResult {
  // 실제 요청 IP를 확보했으면 환경과 관계없이 그대로 사용한다.
  if (extractedIp) {
    return {
      available: true,
      ip: extractedIp,
    };
  }

  // Vercel Preview/Production에서는 공용 fallback bucket을 만들지 않고 fail-closed한다.
  if (process.env.NODE_ENV === "production") {
    return {
      available: false,
      reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
    };
  }

  // 로컬 development와 test에서만 명시적인 loopback fallback을 허용한다.
  return {
    available: true,
    ip: LOCAL_CLIENT_IP_FALLBACK,
  };
}

/**
 * Route Handler 요청에서 Auth Rate Limit용 trusted 사용자 IP를 확인한다.
 *
 * @param request NextRequest
 * @returns trusted 사용자 IP 확인 결과
 */
export function getTrustedAuthClientIp(
  request: NextRequest,
): TrustedAuthClientIpResult {
  return resolveTrustedAuthClientIp(extractClientIp(request.headers));
}

/**
 * Server Action에서 Auth Rate Limit용 trusted 사용자 IP를 확인한다.
 *
 * @returns trusted 사용자 IP 확인 결과
 */
export async function getTrustedAuthServerActionClientIp(): Promise<TrustedAuthClientIpResult> {
  const requestHeaders = await headers();

  return resolveTrustedAuthClientIp(extractClientIp(requestHeaders));
}
