import type { GlobalError } from "../errors/globalError";

/**
 * 응답이 오지 않아도 사용자를 무한정 기다리게 두지 않는 상한.
 *
 * 이 값이 없으면 서버가 응답하지 않을 때 버튼이 "로그인 중..."에 영원히 묶인다.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * auth API에 JSON 요청을 보내고 응답 body를 돌려준다.
 *
 * 하는 일:
 * - transport 단계 실패(오프라인, 응답 없음, 계약 body가 아닌 5xx)를
 *   `GlobalError`로 좁혀서 throw한다.
 * - 서버가 계약 body(`success`/`code`/`data`)를 실어 보낸 실패는 그대로 throw해
 *   code 기반 분기를 그대로 유지한다.
 *
 * 이 매핑이 없으면 fetch가 던지는 `TypeError`가 어떤 타입 가드에도 걸리지 않아,
 * 폼이 네트워크 끊김·응답 없음·게이트웨이 오류를 전부 "일시적인 오류가
 * 발생했습니다."로 뭉뚱그린다.
 *
 * @param url 요청 URL
 * @param init fetch 옵션 (signal은 이 함수가 붙이므로 넘기지 않는다)
 * @returns 파싱된 응답 body
 */
export async function requestAuthApi(
  url: string,
  init: RequestInit,
): Promise<unknown> {
  const controller = new AbortController();

  // abort 사유(reason)는 런타임마다 형태가 달라 신뢰하기 어렵다.
  // 시간 초과로 끊었는지는 직접 기록해서 판별한다.
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  let response: Response;

  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch {
    clearTimeout(timeoutId);

    const globalError: GlobalError = didTimeout
      ? { type: "timeout" }
      : { type: "network" };

    throw globalError;
  }

  let body: unknown;

  try {
    // 타이머는 body를 다 읽을 때까지 유지한다. fetch는 헤더만 오면 resolve하므로,
    // 여기서 타이머를 이미 껐으면 본문이 끝나지 않는 응답에 무한정 묶인다.
    body = await response.json();
  } catch {
    // 프록시·호스팅 플랫폼이 끼어들면 계약 body 대신 HTML 오류 페이지가 온다.
    // 서버 쪽 문제이므로 server로 올린다.
    const globalError: GlobalError = didTimeout
      ? { type: "timeout" }
      : { type: "server" };

    throw globalError;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    // 서버 계약 body는 그대로 올려 code 기반 분기(자격증명 실패, rate limit 등)를 유지한다.
    throw body;
  }

  return body;
}
