// TODO(v2 - CSP hardening & observability)
//
// 1. CSP violation report 수집
// - Reporting-Endpoints + report-to 기반 수집 구조 검토
// - 필요 시 report-uri fallback 고려
// - /api/csp-report 또는 외부 도구(Sentry 등) 연동 검토
//
// 2. 환경별 CSP 적용 전략
// - development / production에서 Report-Only 적용 여부 결정
// - dev 환경에서 과도한 로그 발생 시 처리 전략 수립
//
// 3. CSP 정책 강화
// - script-src에서 'unsafe-inline', 'unsafe-eval' 제거 가능성 검토
// - nonce 또는 hash 기반 strict CSP 전환 검토
//
// 4. 리소스 출처 제한
// - connect-src, img-src, font-src를 실제 사용 origin으로 축소
// - supabase 및 외부 API 도메인 화이트리스트화

import type { NextConfig } from "next";

const supabaseHostname =
  process.env.NEXT_PUBLIC_SUPABASE_HOSTNAME ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined);

// [설계 의도] securityHeaders는 top-level에서 정의하지 않고 headers() 내부에서 생성
// 이유: isProduction을 top-level 상수로 두면 import 시점에 고정되어 테스트에서 NODE_ENV 변경이 반영되지 않음

const nextConfig: NextConfig = {
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
    // isProduction을 headers() 실행 시점에서 평가
    // 이유: 테스트에서 process.env.NODE_ENV 변경이 반드시 반영되어야 하므로 lazy 평가 필수
    const isProduction = process.env.NODE_ENV === "production";

    // [강제 CSP] 최소 3개 디렉티브만 포함 — 즉시 적용
    // spec: must_include_all_three_directives, must_not_include_additional_directives
    // 설계 의도: 이 3개 디렉티브는 런타임 기능을 깨지 않으므로 즉시 강제 적용 가능
    // - object-src 'none'      : 플러그인(Flash, Java 등) 로드 차단 (현대 웹에서 필요 없음)
    // - base-uri 'self'        : 악성 <base> 태그로 상대경로 해석이 변조되는 것 방지
    // - frame-ancestors 'none' : 이 페이지가 iframe 안에 삽입되는 것 차단 (X-Frame-Options 보완)
    const cspEnforced = [
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
    ].join("; ");

    // [Report-Only CSP] 기존 앱 동작을 허용하면서 관측만 수행
    // 목적:
    // - 실제 차단 없이 현재 앱이 어떤 정책 위반을 일으키는지 확인
    // - 추후 강제 CSP 전환 전 안전하게 로그/콘솔 기반 점검
    //
    // 디렉티브 설명:
    // - default-src 'self'        : 기본 리소스 로드를 same-origin으로 제한
    // - img-src ...               : 이미지 로드 허용 범위
    // - font-src ...              : 폰트 로드 허용 범위
    // - style-src ...             : 스타일 로드 허용 범위
    // - script-src ...            : 스크립트 로드/실행 허용 범위
    // - connect-src ...           : fetch/XHR/WebSocket 등 네트워크 연결 허용 범위
    //
    // 주의:
    // - 'unsafe-inline', 'unsafe-eval'은 완화된 설정 (현재는 필요하므로 유지, 추후 개선)
    // - 강제 CSP 디렉티브(object-src, base-uri, frame-ancestors)는 혼재하지 않음
    const cspReportOnly = [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline' https:",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "connect-src 'self' https:",
    ].join("; ");

    return [
      {
        // 모든 route에 전역 적용
        // 이유: spec invariant — no_partial_header_application
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            // 역할:
            // - 이 페이지가 iframe/frame 안에 삽입되는 것을 차단
            // - clickjacking 공격 방어
            // DENY:
            // - 어떤 출처에서도 이 페이지를 frame으로 포함할 수 없음
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            // 역할:
            // - 브라우저의 MIME type 추측(sniffing) 금지
            // - 서버가 선언한 Content-Type을 임의로 바꿔 해석하지 못하게 함
            // 효과:
            // - 텍스트/파일 응답이 스크립트처럼 오해되어 실행되는 위험 완화
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            // 역할:
            // - 다른 페이지/리소스로 이동할 때 Referer 헤더에 어느 정도 정보를 보낼지 제어
            // strict-origin-when-cross-origin:
            // - same-origin 요청: 전체 URL referrer 전송 가능
            // - cross-origin 요청: origin만 전송
            // - HTTPS -> HTTP 다운그레이드 요청: referrer 미전송
            // 효과:
            // - 외부 사이트로 내부 경로/쿼리 정보가 과도하게 노출되는 것을 줄임
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            // 역할:
            // - 브라우저 민감 권한 기능 사용 범위를 제한
            // 현재 정책:
            // - camera 사용 금지
            // - microphone 사용 금지
            // - geolocation 사용 금지
            // 효과:
            // - 현재 서비스에서 필요 없는 브라우저 권한 표면 자체를 축소
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            // 역할:
            // - 지정된 보안 정책을 즉시 강제 적용 (위반 시 리소스 차단)
            // 포함 디렉티브:
            // - object-src 'none'      : 플러그인 로드 차단
            // - base-uri 'self'        : base 태그 해석 제한
            // - frame-ancestors 'none' : iframe 삽입 차단
            value: cspEnforced,
          },
          {
            key: "Content-Security-Policy-Report-Only",
            // 역할:
            // - 정책을 강제하지 않고 위반만 관측 (차단 없음)
            // - 브라우저 콘솔/리포트에서 정책 위반 정보 수집
            // 목적:
            // - 기존 기능 영향 없이 리소스 사용 패턴 분석
            // - 추후 강제 CSP 전환 전 안전성 검증
            value: cspReportOnly,
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
                  // 역할:
                  // - 브라우저에게 이 사이트는 항상 HTTPS로만 접근해야 한다고 강제
                  // 효과:
                  // - HTTP downgrade 공격 완화
                  // - 평문 HTTP 접근 차단
                  //
                  // 현재 값 의미:
                  // - max-age=300      : 5분 동안 HTTPS 강제 기억
                  // - includeSubDomains    : 모든 서브도메인에도 동일 적용
                  //
                  // 주의:
                  // - 운영 환경 HTTPS 구성이 완전해야만 안전하게 적용 가능
                  value: "max-age=300; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
