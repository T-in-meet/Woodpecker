import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom 환경에서는 server-only가 import되는 순간 throw한다. 저장소 관례대로 비운다.
// vi.mock은 import보다 먼저 호이스팅되므로 아래 정적 import가 안전하다.
vi.mock("server-only", () => ({}));

import { type AiErrorKind, CloudflareAiError, generateJson } from "../client";

const ACCOUNT_ID = "test-account-id";
const API_TOKEN = "test-api-token";

const RESPONSE_SCHEMA = {
  type: "object",
  properties: { score: { type: "integer" } },
  required: ["score"],
};

/** 노트 본문을 흉내낸다. 에러 메시지에 새어 나가지 않는지 확인하는 데 쓴다. */
const PROMPT = "노트 본문과 사용자 답안이 담긴 프롬프트";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", ACCOUNT_ID);
  vi.stubEnv("CLOUDFLARE_API_TOKEN", API_TOKEN);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** Cloudflare 성공 응답을 흉내낸다. `result`의 껍데기는 호출자가 정한다. */
function mockOk(result: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, errors: [], result }),
  });
}

function mockRaw(status: number, body: unknown) {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function namedError(name: string): Error {
  const error = new Error("실패");
  error.name = name;
  return error;
}

function requestBody(): Record<string, unknown> {
  return JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
}

async function expectKind(
  promise: Promise<unknown>,
  kind: AiErrorKind,
): Promise<CloudflareAiError> {
  const error = await promise.catch((e: unknown) => e);

  expect(error).toBeInstanceOf(CloudflareAiError);
  expect((error as CloudflareAiError).kind).toBe(kind);

  return error as CloudflareAiError;
}

describe("generateJson — 요청", () => {
  beforeEach(() => {
    mockOk({ response: '{"score":1}' });
  });

  it("계정 ID와 모델명을 URL에 담아 호출한다", async () => {
    await generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/@cf/openai/gpt-oss-120b`,
    );
  });

  it("Bearer 토큰을 헤더에 담는다", async () => {
    await generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA });

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
    });
  });

  it("스키마를 래핑 없이 json_schema에 그대로 싣는다", async () => {
    // Cloudflare는 OpenAI와 달리 { name, schema } 래핑을 쓰지 않는다.
    await generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA });

    expect(requestBody().response_format).toEqual({
      type: "json_schema",
      json_schema: RESPONSE_SCHEMA,
    });
  });

  it("max_tokens를 명시한다", async () => {
    // Workers AI 기본값은 256이라 명시하지 않으면 응답이 잘린다.
    await generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA });

    expect(requestBody().max_tokens).toBe(8192);
  });

  it("messages 요청에 검증된 low reasoning_effort를 명시한다", async () => {
    await generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA });

    expect(requestBody().reasoning_effort).toBe("low");
    expect(requestBody()).not.toHaveProperty("reasoning");
  });

  it("temperature를 준 경우에만 싣는다", async () => {
    await generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA });
    expect(requestBody()).not.toHaveProperty("temperature");

    fetchMock.mockClear();
    await generateJson({
      prompt: PROMPT,
      responseSchema: RESPONSE_SCHEMA,
      temperature: 1.2,
    });
    expect(requestBody().temperature).toBe(1.2);
  });

  it("abortSignal을 fetch에 넘긴다", async () => {
    const controller = new AbortController();

    await generateJson({
      prompt: PROMPT,
      responseSchema: RESPONSE_SCHEMA,
      abortSignal: controller.signal,
    });

    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });
});

describe("generateJson — 성공 응답 껍데기", () => {
  it("chat.completion 형식(choices[0].message.content)을 읽는다", async () => {
    // 현재 쓰는 gpt-oss가 이 형식으로 돌려준다.
    mockOk({
      choices: [
        { message: { content: '{"score":80}' }, finish_reason: "stop" },
      ],
    });

    await expect(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
    ).resolves.toBe('{"score":80}');
  });

  it("result.response 문자열을 읽는다", async () => {
    // llama·mistral 계열이 쓰는 형식. 모델을 바꿔도 깨지지 않아야 한다.
    mockOk({ response: '{"score":70}' });

    await expect(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
    ).resolves.toBe('{"score":70}');
  });

  it("result.response가 이미 파싱된 객체면 문자열로 되돌린다", async () => {
    mockOk({ response: { score: 60 } });

    await expect(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
    ).resolves.toBe('{"score":60}');
  });
});

describe("generateJson — 응답 끊김 진단 로그", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("finish_reason=length + content가 끊긴 JSON이면 진단 로그를 남기고 truncated로 던진다", async () => {
    mockOk({
      choices: [
        { message: { content: '{"score":1' }, finish_reason: "length" },
      ],
      usage: { completion_tokens_details: { reasoning_tokens: 8000 } },
    });

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "truncated",
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("finish_reason=length로 응답이 끊김"),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("reasoning_tokens=8000"),
    );
  });

  it("finish_reason=length + content가 비어 있으면 진단 로그를 남기고 truncated로 던진다", async () => {
    // usage.reasoning_tokens(최상위)로도 값을 읽어야 한다 — completion_tokens_details가 없는 경우.
    mockOk({
      choices: [{ message: { content: "" }, finish_reason: "length" }],
      usage: { reasoning_tokens: 8192 },
    });

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "truncated",
    );

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("reasoning_tokens=8192"),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("content_length=0"),
    );
  });

  it("finish_reason=length여도 content가 완전한 JSON이면 정상 반환한다", async () => {
    // max_tokens에 딱 맞게 끝나 완전한 JSON으로 남는 경계 사례.
    mockOk({
      choices: [
        { message: { content: '{"score":80}' }, finish_reason: "length" },
      ],
      usage: { completion_tokens_details: { reasoning_tokens: 8100 } },
    });

    await expect(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
    ).resolves.toBe('{"score":80}');
  });

  it("finish_reason=stop(정상 종료)이면 로그를 남기지 않는다", async () => {
    mockOk({
      choices: [
        { message: { content: '{"score":80}' }, finish_reason: "stop" },
      ],
    });

    await generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA });

    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe("generateJson — provider 실패", () => {
  it("HTTP 비-2xx면 code와 status를 담아 던진다", async () => {
    mockRaw(429, { success: false, errors: [{ code: 3036, message: "한도" }] });

    const error = await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );

    expect(error.code).toBe(3036);
    expect(error.status).toBe(429);
  });

  it("HTTP 200이어도 success: false면 실패로 다룬다", async () => {
    mockRaw(200, { success: false, errors: [{ code: 3040 }], result: {} });

    const error = await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );

    expect(error.code).toBe(3040);
  });

  it("요청 과대(3006)도 코드로 구분된다", async () => {
    mockRaw(413, { success: false, errors: [{ code: 3006 }] });

    const error = await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );

    expect(error.code).toBe(3006);
  });

  it("응답 본문이 JSON이 아니면 던진다", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );
  });

  it("choices가 비어 있으면 던진다", async () => {
    mockOk({ choices: [] });

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );
  });

  it("content가 빈 문자열이면 던진다", async () => {
    mockOk({ choices: [{ message: { content: "   " } }] });

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );
  });

  it("response가 빈 문자열이면 던진다", async () => {
    mockOk({ response: "" });

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );
  });

  it("알 수 없는 껍데기는 성공처럼 반환하지 않고 던진다", async () => {
    // 그대로 문자열로 만들어 돌려주면 호출부 Zod가 "형식 이탈"로 오인해
    // 진짜 원인(응답 구조 변경)이 묻힌다.
    mockOk({ somethingNew: { text: '{"score":50}' } });

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );
  });
});

describe("generateJson — 로컬 실패", () => {
  it("TimeoutError는 timeout으로 구분한다", async () => {
    // AbortSignal.timeout()은 envelope를 받기 전에 던지므로 CF 코드 3007로 오지 않는다.
    fetchMock.mockRejectedValue(namedError("TimeoutError"));

    const error = await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "timeout",
    );

    expect(error.code).toBeUndefined();
  });

  it("AbortError는 aborted로 구분한다", async () => {
    fetchMock.mockRejectedValue(namedError("AbortError"));

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "aborted",
    );
  });

  it("그 밖의 네트워크 오류는 network로 구분한다", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "network",
    );
  });

  it("이미 abort된 signal을 받으면 aborted로 구분한다", async () => {
    const controller = new AbortController();
    controller.abort();
    // 실제 fetch는 이미 취소된 signal에 AbortError로 즉시 reject한다.
    fetchMock.mockRejectedValue(namedError("AbortError"));

    await expectKind(
      generateJson({
        prompt: PROMPT,
        responseSchema: RESPONSE_SCHEMA,
        abortSignal: controller.signal,
      }),
      "aborted",
    );
  });
});

describe("generateJson — 설정", () => {
  it("계정 ID가 없으면 호출 없이 config로 던진다", async () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "config",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("API 토큰이 없으면 호출 없이 config로 던진다", async () => {
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");

    await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "config",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("generateJson — 에러 메시지 유출", () => {
  it("프롬프트와 provider 원문 message를 메시지에 담지 않는다", async () => {
    // provider가 요청 일부를 echo할 가능성을 배제할 수 없으므로 원문을 통째로 버린다.
    const leaked = "노트 본문과 사용자 답안이 담긴 프롬프트";
    mockRaw(400, {
      success: false,
      errors: [{ code: 3003, message: `입력이 올바르지 않습니다: ${leaked}` }],
    });

    const error = await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );

    expect(error.message).not.toContain(leaked);
    expect(error.message).not.toContain("입력이 올바르지 않습니다");
    // 진단에 필요한 정보는 남아 있어야 한다.
    expect(error.message).toContain("3003");
  });

  it("API 토큰을 메시지에 담지 않는다", async () => {
    mockRaw(403, { success: false, errors: [{ code: 3023 }] });

    const error = await expectKind(
      generateJson({ prompt: PROMPT, responseSchema: RESPONSE_SCHEMA }),
      "provider",
    );

    expect(error.message).not.toContain(API_TOKEN);
  });
});
