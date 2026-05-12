import { headers } from "next/headers";

/**
 * Server Action에서 클라이언트 IP를 추출한다.
 *
 * 이유:
 * - Server Action은 NextRequest에 접근할 수 없다
 * - headers()를 통해 동일한 헤더를 읽어야 한다
 *
 * 정책:
 * - getClientIp와 동일한 우선순위/보안 가정을 따른다
 */
export async function getServerActionClientIp(): Promise<string> {
  const h = await headers();

  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = h.get("x-forwarded-for")?.trim();
  if (forwarded) return forwarded;

  return "unknown";
}
