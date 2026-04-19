import type { NextRequest } from "next/server";

/**
 * auth 라우트에서 JSON 본문 파싱 실패를 구분하기 위한 공통 에러
 */
export class AuthJsonParseError extends Error {}

/**
 * auth 라우트 공통 JSON 파싱 유틸
 */
export async function parseAuthJsonRequestBody(
  request: NextRequest,
): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AuthJsonParseError();
  }
}
