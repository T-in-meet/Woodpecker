import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const MARKDOWN_ALTERNATES: Record<string, string> = {
  "/": "/index.md",
  "/privacy": "/privacy.md",
  "/terms": "/terms.md",
};

const supabaseHostname =
  process.env.NEXT_PUBLIC_SUPABASE_HOSTNAME ??
  (process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : undefined);

// report-uri는 W3C CSP3에서 deprecated이지만 Firefox/Safari가 아직 report-to를 지원하지 않아
// 두 지시어를 병기한다. report-to는 응답 헤더 Reporting-Endpoints의 그룹명을 참조한다.
export const CSP_REPORT_ENDPOINT_GROUP = "csp-endpoint";
export const CSP_REPORT_PATH = "/api/csp-report";

function buildCspDirectives(nonce: string): string[] {
  return [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // style-src: React 19의 <style> precedence hoisting, Next.js DevOverlay,
    //   동적 CSS-in-JS 라이브러리(toast 등), 폰트 inject 등으로 인해
    //   런타임에 nonce 없이 <style> 태그가 head에 다수 inject된다.
    //   현 시점에서 nonce-only 정책은 실현 불가하므로 'unsafe-inline'으로 완화한다.
    //   XSS 방어의 핵심인 script-src는 nonce/strict-dynamic을 유지하므로
    //   인라인 style만으로 코드 실행은 불가.
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data: blob:",
      supabaseHostname && `https://${supabaseHostname}`,
    ]
      .filter(Boolean)
      .join(" "),
    [
      "connect-src 'self'",
      supabaseHostname && `https://${supabaseHostname}`,
      supabaseHostname && `wss://${supabaseHostname}`,
    ]
      .filter(Boolean)
      .join(" "),
    "font-src 'self' data: https://cdn.jsdelivr.net",
    "worker-src 'self'",
    "media-src 'none'",
    "manifest-src 'self'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_ENDPOINT_GROUP}`,
  ];
}

export function buildCspEnforced(nonce: string): string {
  return buildCspDirectives(nonce).join("; ");
}

// Report-Only는 enforced와 동일하게 발행한다. 추후 강화 실험 시
// 이 빌더에서만 directives를 오버라이드하여 위반 데이터를 수집한다.
export function buildCspReportOnly(nonce: string): string {
  return buildCspDirectives(nonce).join("; ");
}

export function buildReportingEndpoints(): string {
  return `${CSP_REPORT_ENDPOINT_GROUP}="${CSP_REPORT_PATH}"`;
}

/**
 * Supabase session refresh + cookie sync 담당
 *
 * updateSession 내부에서:
 * - auth.getUser() 호출을 통해 세션 갱신
 * - response cookie 동기화 수행
 *
 * 추가 로직:
 * - Accept: text/markdown 요청은 .md 라우트로 rewrite (콘텐츠 협상)
 * - 응답에 Link 헤더와 Vary: Accept 추가하여 마크다운 대안 발견 가능하게 함
 * - 요청마다 nonce 생성 후 CSP 헤더를 동적으로 설정
 * - x-nonce 헤더를 request에 전달하여 서버 컴포넌트에서 접근 가능하게 함
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const markdownPath = MARKDOWN_ALTERNATES[pathname];

  if (markdownPath) {
    const accept = request.headers.get("accept") ?? "";
    if (accept.includes("text/markdown")) {
      const url = request.nextUrl.clone();
      url.pathname = markdownPath;
      return NextResponse.rewrite(url);
    }
  }

  const nonce = btoa(crypto.randomUUID().replaceAll("-", ""));
  const response = await updateSession(request, { "x-nonce": nonce });

  response.headers.set("Content-Security-Policy", buildCspEnforced(nonce));
  response.headers.set(
    "Content-Security-Policy-Report-Only",
    buildCspReportOnly(nonce),
  );
  response.headers.set("Reporting-Endpoints", buildReportingEndpoints());

  if (markdownPath) {
    response.headers.append(
      "Link",
      `<${markdownPath}>; rel="alternate"; type="text/markdown"`,
    );
    response.headers.append("Vary", "Accept");
  }

  return response;
}

export const config = {
  matcher: [
    // send-email hook은 서버-투-서버 호출이라 사용자 세션 미들웨어를 타면 인증 토큰 오류가 발생한다.
    "/((?!_next/static|_next/image|favicon.ico|(?:sw|swe-worker-.*)\\.js(?:\\.map)?|api/auth/hooks/send-email|api/csp-report|(?:index|privacy|terms)\\.md|llms(?:-full)?\\.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
