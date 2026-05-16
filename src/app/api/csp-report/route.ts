/**
 * CSP 위반 리포트 수신 엔드포인트
 *
 * CSP 헤더의 `report-uri /api/csp-report` 설정에 의해
 * 브라우저가 CSP 위반을 감지하면 이 엔드포인트로 자동 POST 요청을 보낸다.
 *
 * 현재는 서버 콘솔에 위반 내용을 출력하는 최소 구현.
 * 추후 Sentry 등 로그 수집 도구와 연결하여 모니터링 대시보드 구성 가능.
 */
import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    // 추후 Sentry/로그 수집 도구로 송출. 최소 구현은 console.warn.
    console.warn("[CSP-VIOLATION]", JSON.stringify(body));
  } catch {
    // malformed JSON은 무시
  }
  return new NextResponse(null, { status: 204 });
}
