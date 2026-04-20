/**
 * IP를 로깅용으로 마스킹한다.
 * - 원본 IP는 직접 기록하지 않는다.
 * - IPv4는 앞 2옥텟만 유지하고 나머지는 마스킹한다.
 * - IPv6는 앞 2세그먼트만 유지하고 나머지는 마스킹한다.
 */
export function maskIpForLogging(ip: string): string {
  if (!ip) return "***";

  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`;
    }
  }

  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}::*`;
    }
  }

  return "***";
}
