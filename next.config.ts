import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const supabaseHostname =
  process.env.NEXT_PUBLIC_SUPABASE_HOSTNAME ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined);

export function shouldDisableSerwist() {
  return (
    process.env.NODE_ENV === "development" && process.env.ENABLE_SW !== "true"
  );
}

// [설계 의도] securityHeaders는 top-level에서 정의하지 않고 headers() 내부에서 생성
// 이유: isProduction을 top-level 상수로 두면 import 시점에 고정되어 테스트에서 NODE_ENV 변경이 반영되지 않음

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            port: "",
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // ⚠️  HSTS(Strict-Transport-Security) 적용 전 반드시 확인사항:
          // - HSTS는 브라우저에 max-age(86400초 = 1일)동안 캐시된다
          // - production에서 한 번 적용되면 해당 브라우저는 HTTP 접근을 설정 기간 동안 차단한다
          // - 배포 전에 HTTPS가 정상 동작하는지 반드시 확인해야 한다
          // - 잘못 적용 시 사용자 접근이 max-age 기간 동안 차단될 수 있다
          // - preload 옵션은 이번 단계에서 제외 (HSTS preload list 등록은 별도 절차 필요)
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=86400; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default withSerwist({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  // dev에서는 기본적으로 SW 비활성화 (HMR 충돌 회피).
  // 푸시 알림을 로컬에서 검증할 때만 ENABLE_SW=true로 일시 활성화.
  disable: shouldDisableSerwist(),
})(nextConfig);
