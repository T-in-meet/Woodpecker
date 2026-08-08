import { GoogleGenAI } from "@google/genai";

/**
 * Gemini 클라이언트를 처음 호출될 때 한 번만 만들어 재사용한다(지연 초기화).
 * 파일 최상위에서 만들면 import되는 순간 키를 검사해서, Gemini를 쓰지 않는
 * `next build` 단계에서도 키가 없으면 빌드가 실패하기 때문이다.
 * 키가 없으면 에러를 던지므로 호출하는 쪽에서 try/catch로 감싼다.
 */
let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (client) {
    return client;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.");
  }

  client = new GoogleGenAI({ apiKey });

  return client;
}
