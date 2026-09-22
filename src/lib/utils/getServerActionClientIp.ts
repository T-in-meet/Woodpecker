import { headers } from "next/headers";

import { extractClientIp } from "./getClientIp";

/**
 * Server Action에서 클라이언트 IP를 추출한다.
 *
 * 이유:
 * - Server Action은 NextRequest에 접근할 수 없다
 * - headers()를 통해 Route와 동일한 헤더 정책을 사용해야 한다
 *
 * 주의:
 * - "unknown" fallback은 기존 Auth 흐름 호환을 위한 legacy 동작이다.
 * - 새로운 Auth Rate Limit 흐름에서는 trusted IP helper를 사용한다.
 *
 * @returns 클라이언트 IP 또는 "unknown"
 */
export async function getServerActionClientIp(): Promise<string> {
  const requestHeaders = await headers();

  return extractClientIp(requestHeaders) ?? "unknown";
}
