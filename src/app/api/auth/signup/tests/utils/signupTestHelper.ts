import { NextRequest } from "next/server";

/**
 * 테스트용 NextRequest 생성 헬퍼
 *
 * 목적:
 * - API route 테스트에서 실제 HTTP 요청을 흉내내기 위해 사용
 * - 매 테스트마다 동일한 Request 생성 코드를 반복하지 않도록 공통화
 *
 * 특징:
 * - method는 POST로 고정 (회원가입 API 기준)
 * - Content-Type은 application/json으로 설정
 * - 전달받은 body를 JSON.stringify하여 request body로 주입
 *
 * 사용 맥락:
 * - route.test.ts에서 POST 핸들러 호출 시 사용
 * - 실제 fetch 없이 Next.js Route Handler를 직접 테스트 가능하게 해줌
 *
 * @param body 요청에 포함할 JSON payload 객체
 * @returns Next.js Route Handler에서 사용할 수 있는 NextRequest 인스턴스
 */
export function makeRequest(body: object): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
