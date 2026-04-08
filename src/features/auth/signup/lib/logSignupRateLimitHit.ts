type RateLimitDimension = "ip" | "email";

type LogSignupRateLimitHitParams =
  | {
      dimension: "ip";
      route: string;
      limit: number;
      windowMs: number;
      ip: string;
    }
  | {
      dimension: "email";
      route: string;
      limit: number;
      windowMs: number;
      email: string;
    };

function maskIp(ip: string): string {
  const parts = ip.split(".");

  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }

  return "***";
}

function maskEmail(email: string): string {
  const [localPart, domain = ""] = email.split("@");
  const firstChar = localPart?.[0]?.toLowerCase() ?? "*";

  return `${firstChar}***@${domain}`;
}

/**
 * 회원가입 rate limit hit 로그를 구조화된 형태로 남긴다.
 *
 * 목적:
 * - 운영 환경에서 abuse 패턴과 false positive를 추적할 수 있도록 한다.
 * - raw IP/email 전체 노출 대신 최소한의 마스킹된 식별자만 남긴다.
 */
export function logSignupRateLimitHit(
  params: LogSignupRateLimitHitParams,
): void {
  if (params.dimension === "ip") {
    console.warn("signup_rate_limit_hit", {
      dimension: params.dimension satisfies RateLimitDimension,
      route: params.route,
      limit: params.limit,
      windowMs: params.windowMs,
      ipMasked: maskIp(params.ip),
    });
    return;
  }

  console.warn("signup_rate_limit_hit", {
    dimension: params.dimension satisfies RateLimitDimension,
    route: params.route,
    limit: params.limit,
    windowMs: params.windowMs,
    emailMasked: maskEmail(params.email),
  });
}
