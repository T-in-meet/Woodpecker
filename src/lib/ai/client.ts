import "server-only";

/**
 * Cloudflare Workers AI 클라이언트.
 *
 * 같은 폴더의 `prompts.ts`는 클라이언트 컴포넌트도 import한다(`QuizType` 타입).
 * 이 파일은 API 토큰을 읽으므로 `server-only`로 잠가, 나중에 실수로 클라이언트
 * 번들에 딸려 들어가면 빌드가 깨지도록 한다.
 */

/** 품질 실측으로 고른 모델. 선정 근거는 `scripts/cloudflare-quality-test.mjs` 참고. */
const MODEL = "@cf/openai/gpt-oss-120b";

/**
 * Workers AI의 `max_tokens` 기본값은 256이라 명시하지 않으면 응답이 잘린다.
 * gpt-oss는 reasoning 토큰도 이 한도를 함께 쓴다.
 */
const MAX_OUTPUT_TOKENS = 8192;

/**
 * 실제 노트 품질 비교에서 형식 통과율을 유지하면서 지연과 Neurons를 줄인 값.
 * 현재 `/ai/run`의 `messages` 요청에서는 Responses 형태의 `reasoning.effort`가 아니라
 * Chat Completions 형태의 `reasoning_effort`만 적용되는 것을 분리 호출로 확인했다.
 */
const REASONING_EFFORT = "low";

/**
 * 호출부가 분기할 오류 종류. Cloudflare가 주는 숫자 코드와는 층이 다르다.
 *
 * `AbortSignal`로 fetch가 끊기면 응답 envelope를 받기 전에 예외가 나므로,
 * Cloudflare의 timeout/abort 코드(3007·3008)로는 앱의 실제 타임아웃을 못 잡는다.
 * 그래서 로컬에서 끊긴 경우를 별도 종류로 둔다.
 */
export const AI_ERROR_KINDS = [
  "config",
  "timeout",
  "aborted",
  "network",
  "provider",
  "truncated",
] as const;

export type AiErrorKind = (typeof AI_ERROR_KINDS)[number];

/**
 * Cloudflare 호출 실패.
 *
 * 메시지에는 프롬프트·노트 본문·답안은 물론 **Cloudflare가 돌려준 원문 message도 담지 않는다.**
 * 공급자가 요청 일부를 그대로 되돌려 줄 가능성을 배제할 수 없어서, 로그로 새어 나갈 경로를
 * 아예 만들지 않는다. 진단에 필요한 건 `kind`·`code`·`status`로 충분하다.
 */
export class CloudflareAiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    readonly code?: number,
    readonly status?: number,
  ) {
    super(
      `Cloudflare AI 호출 실패 (kind=${kind}` +
        (code !== undefined ? `, code=${code}` : "") +
        (status !== undefined ? `, status=${status}` : "") +
        ")",
    );
    this.name = "CloudflareAiError";
  }
}

type GenerateJsonParams = {
  prompt: string;
  /** `toCloudflareResponseSchema()`의 결과. 래핑 없이 그대로 실린다. */
  responseSchema: unknown;
  temperature?: number;
  // exactOptionalPropertyTypes가 켜져 있어, 호출부가 "없을 수도 있는 값"을 그대로
  // 넘길 수 있도록 undefined를 명시한다.
  abortSignal?: AbortSignal | undefined;
};

type Credentials = { accountId: string; apiToken: string };

/**
 * 환경변수를 호출 시점에 읽는다.
 *
 * 모듈 최상위에서 읽으면 import되는 순간 검사가 돌아서, AI를 쓰지 않는 `next build`
 * 단계에서도 키가 없으면 빌드가 실패한다. CI의 build job에는 AI 키를 주입하지 않는다.
 */
function readCredentials(): Credentials {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    // toAiFailureReason은 이 kind를 다른 일시적 오류와 같은 "unknown"으로 묶는다
    // (사용자에게 보여줄 말이 다르지 않아서다). 대신 배포 오설정을 일시적 장애와
    // 구분해 온콜이 바로 알아볼 수 있도록 여기서 명시적으로 남긴다.
    console.error(
      "[ai/client] CLOUDFLARE_ACCOUNT_ID 또는 CLOUDFLARE_API_TOKEN이 설정되지 않음",
    );
    throw new CloudflareAiError("config");
  }

  return { accountId, apiToken };
}

/**
 * 우리 쪽 `AbortSignal`로 끊긴 예외인지.
 *
 * fetch 호출뿐 아니라 응답 본문을 읽는 도중에도 발화한다. 본문 스트리밍 중에 끊긴 것을
 * 파싱 실패로 뭉치면 앱 타임아웃이 provider 실패로 둔갑해 지연 안내가 나가지 않는다.
 */
function isLocalAbort(error: unknown): boolean {
  const name = error instanceof Error ? error.name : "";

  return name === "TimeoutError" || name === "AbortError";
}

/** fetch가 던진 예외를 오류 종류로 옮긴다. */
function toLocalFailure(error: unknown): CloudflareAiError {
  const name = error instanceof Error ? error.name : "";

  if (name === "TimeoutError") {
    return new CloudflareAiError("timeout");
  }

  if (name === "AbortError") {
    return new CloudflareAiError("aborted");
  }

  return new CloudflareAiError("network");
}

/** Cloudflare 오류 응답에서 코드만 꺼낸다. message는 의도적으로 버린다. */
function readErrorCode(body: unknown): number | undefined {
  if (body === null || typeof body !== "object") {
    return undefined;
  }

  const errors = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined;
  }

  // 원소가 null이거나 객체가 아닐 수 있다. 여기서 막지 않으면 TypeError가
  // CloudflareAiError 대신 밖으로 나가 status·code 진단이 통째로 사라진다.
  const first: unknown = errors[0];
  if (first === null || typeof first !== "object") {
    return undefined;
  }

  const code = (first as { code?: unknown }).code;
  return typeof code === "number" ? code : undefined;
}

/**
 * 응답 본문에서 모델이 생성한 JSON 문자열을 꺼낸다.
 *
 * 껍데기가 모델마다 다르다. 지금 쓰는 `gpt-oss`는 OpenAI `chat.completion` 형식이고,
 * `llama`·`mistral` 계열은 `result.response`에 담아 준다. 공식 문서는 후자만 설명하므로
 * 실측한 형태를 모두 다뤄, 나중에 모델을 바꿔도 이 함수만 보면 되게 한다.
 *
 * **아는 형태가 아니면 던진다.** 알 수 없는 응답을 그대로 문자열로 만들어 돌려주면
 * 호출부의 Zod 검증이 "형식 이탈"로 오인해, 실제 원인(껍데기 변경)이 묻힌다.
 */
function extractJsonText(result: unknown): string {
  if (result === null || typeof result !== "object") {
    throw new CloudflareAiError("provider");
  }

  const response = (result as { response?: unknown }).response;

  if (typeof response === "string") {
    if (response.trim().length === 0) {
      throw new CloudflareAiError("provider");
    }
    return response;
  }

  // JSON mode에서는 이미 파싱된 객체로 오기도 한다. 호출부 계약(문자열)에 맞춰 되돌린다.
  if (response !== null && typeof response === "object") {
    return JSON.stringify(response);
  }

  const choices = (result as { choices?: unknown }).choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const choice = choices[0] as {
      finish_reason?: unknown;
      message?: { content?: unknown };
    };
    const content = choice?.message?.content;

    // finish_reason=length는 max_tokens에 걸려 끊겼다는 뜻이다. reasoning 토큰이
    // 답변용 토큰까지 다 먹었을 수 있다. content가 아예 비었을 수도, 중간까지만
    // 채워진 채(끊긴 JSON) 남았을 수도 있다. 후자를 여기서 그대로 반환하면 호출부의
    // JSON.parse가 일반 파싱 실패로 처리해, 원인이 "노트가 너무 큼"이라는 걸 사용자가
    // 알 방법이 없다. 그래서 끊겼다고 표시된 응답은 여기서 미리 파싱해 보고, 실제로
    // 깨져 있으면 구분되는 오류 종류로 던진다. finish_reason·reasoning_tokens·응답
    // 길이는 사용자 데이터가 아니므로 로그에 남겨도 안전하다.
    if (choice?.finish_reason === "length") {
      const usage = (result as { usage?: unknown }).usage as
        | {
            completion_tokens_details?: { reasoning_tokens?: unknown };
            reasoning_tokens?: unknown;
          }
        | undefined;
      const reasoningTokens =
        usage?.completion_tokens_details?.reasoning_tokens ??
        usage?.reasoning_tokens ??
        null;
      const contentLength = typeof content === "string" ? content.length : 0;

      console.error(
        `[ai/client] finish_reason=length로 응답이 끊김 (reasoning_tokens=${String(reasoningTokens)}, content_length=${contentLength})`,
      );

      if (typeof content !== "string" || content.trim().length === 0) {
        throw new CloudflareAiError("truncated");
      }

      try {
        JSON.parse(content);
      } catch {
        throw new CloudflareAiError("truncated");
      }

      return content;
    }

    if (typeof content === "string" && content.trim().length > 0) {
      return content;
    }
  }

  throw new CloudflareAiError("provider");
}

/**
 * 프롬프트를 보내고 모델이 생성한 JSON을 **문자열 그대로** 돌려준다.
 *
 * 파싱과 검증은 호출부가 한다. 이 경계를 유지해야 도메인별 Zod 스키마가
 * 유일한 검증 지점으로 남는다.
 *
 * 키가 없거나 호출이 실패하면 `CloudflareAiError`를 던진다. 호출부는 try/catch로 받는다.
 */
export async function generateJson(
  params: GenerateJsonParams,
): Promise<string> {
  const { accountId, apiToken } = readCredentials();

  const body: Record<string, unknown> = {
    messages: [{ role: "user", content: params.prompt }],
    response_format: {
      type: "json_schema",
      // Cloudflare는 OpenAI와 달리 { name, schema } 래핑을 쓰지 않는다. 스키마를 그대로 넣는다.
      json_schema: params.responseSchema,
    },
    max_tokens: MAX_OUTPUT_TOKENS,
    reasoning_effort: REASONING_EFFORT,
  };

  if (params.temperature !== undefined) {
    body.temperature = params.temperature;
  }

  let response: Response;
  try {
    response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify(body),
        // exactOptionalPropertyTypes가 켜져 있어 undefined를 그대로 넘길 수 없다.
        signal: params.abortSignal ?? null,
      },
    );
  } catch (error) {
    throw toLocalFailure(error);
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch (error) {
    // 헤더는 받았지만 본문을 읽는 사이 우리 쪽 deadline이 걸릴 수 있다.
    // 그 경우까지 provider 실패로 묶으면 kind가 timeout/aborted로 남지 않아
    // 호출부가 지연 안내 대신 일반 실패 문구를 내보낸다.
    if (isLocalAbort(error)) {
      throw toLocalFailure(error);
    }

    throw new CloudflareAiError("provider", undefined, response.status);
  }

  if (!response.ok) {
    throw new CloudflareAiError(
      "provider",
      readErrorCode(parsed),
      response.status,
    );
  }

  // HTTP 200이어도 success: false로 실패를 알리는 경우가 있다.
  if ((parsed as { success?: unknown })?.success === false) {
    throw new CloudflareAiError(
      "provider",
      readErrorCode(parsed),
      response.status,
    );
  }

  return extractJsonText((parsed as { result?: unknown })?.result);
}
