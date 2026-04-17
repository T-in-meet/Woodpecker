import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_HOSTNAME;

// [설계 의도] securityHeaders는 top-level에서 정의하지 않고 headers() 내부에서 생성
// 이유: isProduction을 top-level 상수로 두면 import 시점에 고정되어 테스트에서 NODE_ENV 변경이 반영되지 않음

const nextConfig: NextConfig = {
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
    // isProduction을 headers() 실행 시점에서 평가
    // 이유: 테스트에서 process.env.NODE_ENV 변경이 반드시 반영되어야 하므로 lazy 평가 필수
    const isProduction = process.env.NODE_ENV === "production";

    return [
      {
        // 모든 route에 전역 적용
        // 이유: spec invariant — no_partial_header_application
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
          // - HSTS는 브라우저에 max-age(63072000초 = 2년)동안 캐시된다
          // - production에서 한 번 적용되면 해당 브라우저는 HTTP 접근을 장기간 차단한다
          // - 배포 전에 HTTPS가 정상 동작하는지 반드시 확인해야 한다
          // - 잘못 적용 시 사용자 접근이 최대 2년간 차단될 수 있다
          // - preload 옵션은 이번 단계에서 제외 (HSTS preload list 등록은 별도 절차 필요)
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
