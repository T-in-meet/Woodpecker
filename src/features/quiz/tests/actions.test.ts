import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiRunPersistenceHandle } from "@/features/ai/runs/types";
import { createSupabaseQueryMock } from "@/tests/supabaseQueryMock";

const {
  completeAiRunFailedMock,
  completeAiRunSucceededMock,
  createAdminClientMock,
  createAiRunMock,
  createClientMock,
  generateJsonMock,
} = vi.hoisted(() => ({
  completeAiRunFailedMock: vi.fn(),
  completeAiRunSucceededMock: vi.fn(),
  createAdminClientMock: vi.fn(),
  createAiRunMock: vi.fn(),
  createClientMock: vi.fn(),
  generateJsonMock: vi.fn(),
}));

vi.mock("@/features/ai/runs/persistence", () => ({
  completeAiRunFailed: completeAiRunFailedMock,
  completeAiRunSucceeded: completeAiRunSucceededMock,
  createAiRun: createAiRunMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/features/auth/utils/requireCurrentLegalAcceptance", () => ({
  requireCurrentLegalAcceptance: vi.fn(),
}));

// claim_quiz_generation_v2 · finalize_quiz_generation_v2는 service_role 전용이라
// admin 클라이언트로만 호출된다. 일반 클라이언트는 세션·노트·캐시 조회에만 쓰인다.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

// client.ts는 server-only를 import하는데 jsdom에서는 그것만으로 throw한다.
vi.mock("server-only", () => ({}));

// 호출부가 CloudflareAiError로 실패 이유를 가리므로 class도 함께 제공해야 한다.
// generateJson만 mock하면 instanceof 분기가 조용히 unknown으로 떨어진다.
vi.mock("@/lib/ai/client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");

  return { ...actual, generateJson: generateJsonMock };
});

const { generateQuiz, regenerateQuiz } = await import("../actions");

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-123";
const CLAIM_TOKEN = "55555555-5555-4555-8555-555555555555";
const AI_RUN_ID = "66666666-6666-4666-8666-666666666666";
const QUIZ_ID = "77777777-7777-4777-8777-777777777777";

const AI_RUN: AiRunPersistenceHandle = {
  id: AI_RUN_ID,
  userId: USER_ID,
  featureType: "quiz-generation",
  startedAt: "2026-09-05T00:00:00.000Z",
};

const aiQuestions = {
  questions: [
    {
      type: "ox",
      question: "ALU는 산술 연산을 담당한다.",
      answer: true,
      explanation: "맞다.",
    },
  ],
};

type SupabaseMockInput = {
  userId?: string | null;
  note?: { title: string; content: string } | null;
  cached?: {
    questions: unknown;
    note_content_hash: string;
    recent_questions?: unknown;
  } | null;
  cacheError?: { message: string } | null;
  /** 문자열이면 { status } 로, 객체면 그대로 claim_quiz_generation_v2의 반환값이 된다. */
  claimResult?: string | { status: string; claimToken?: string };
  claimError?: { message: string } | null;
  finalizeResult?: string | { status: string; quizId: string | null };
  finalizeError?: { message: string } | null;
};

function setupSupabase(input: SupabaseMockInput = {}) {
  const {
    userId = USER_ID,
    note = { title: "제목", content: "내용" },
    cached = null,
    cacheError = null,
    claimResult = { status: "ok", claimToken: CLAIM_TOKEN },
    claimError = null,
    finalizeResult = { status: "ok", quizId: QUIZ_ID },
    finalizeError = null,
  } = input;

  const normalizedClaimResult =
    typeof claimResult === "string" ? { status: claimResult } : claimResult;

  const query = createSupabaseQueryMock({
    notes: { data: note },
    quizzes: { data: cached, error: cacheError },
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  });

  createClientMock.mockResolvedValue({
    ...query.supabase,
    auth: { getUser },
  });

  const adminRpc = vi.fn((name: string, _params?: Record<string, unknown>) => {
    if (name === "claim_quiz_generation_v2") {
      return Promise.resolve({
        data: normalizedClaimResult,
        error: claimError,
      });
    }

    if (name === "finalize_quiz_generation_v2") {
      const normalizedFinalizeResult =
        typeof finalizeResult === "string"
          ? {
              status: finalizeResult,
              quizId:
                finalizeResult === "ok" ||
                finalizeResult === "already_completed"
                  ? QUIZ_ID
                  : null,
            }
          : finalizeResult;
      return Promise.resolve({
        data: normalizedFinalizeResult,
        error: finalizeError,
      });
    }

    return Promise.resolve({ data: null, error: null });
  });

  createAdminClientMock.mockReturnValue({ rpc: adminRpc });

  return { ...query, rpc: adminRpc };
}

function rpcNames(rpc: ReturnType<typeof setupSupabase>["rpc"]): string[] {
  return rpc.mock.calls.map(([name]) => name);
}

function mockAiSuccess(payload: unknown = aiQuestions) {
  // 실제 helper와 같이 Provider와 extraction 관측을 남긴 뒤 JSON 문자열을 반환한다.
  generateJsonMock.mockImplementation(async (request: AiRequest) => {
    const text = JSON.stringify(payload);
    const result = {
      choices: [{ finish_reason: "stop", message: { content: text } }],
    };
    const rawResponse = { result, success: true };

    await request.onObservation?.({
      type: "request",
      model: "@cf/openai/gpt-oss-120b",
      body: {
        messages: [{ role: "user", content: request.prompt }],
        response_format: {
          type: "json_schema",
          json_schema: request.responseSchema,
        },
        temperature: request.temperature,
        max_tokens: 8192,
        reasoning_effort: "low",
      },
    });
    await request.onObservation?.({
      type: "provider-response",
      response: rawResponse,
      status: 200,
    });
    await request.onObservation?.({ type: "extraction-started", result });
    await request.onObservation?.({ type: "extraction-completed", text });
    return text;
  });
}

function methodNames(calls: [string, unknown[]][]): string[] {
  return calls.map(([method]) => method);
}

type AiRequest = {
  prompt: string;
  responseSchema: unknown;
  temperature: number;
  abortSignal: AbortSignal;
  onObservation?:
    | ((observation: Record<string, unknown>) => void | Promise<void>)
    | undefined;
};

function aiRequest(): AiRequest {
  return generateJsonMock.mock.calls[0]?.[0] as AiRequest;
}

function responseQuestionType(): unknown {
  const schema = aiRequest().responseSchema as {
    properties: {
      questions: { items: { properties: { type: unknown } } };
    };
  };

  return schema.properties.questions.items.properties.type;
}

/**
 * finalize_quiz_generation_v2가 완료 표시와 quizzes 캐시 upsert를 한 트랜잭션
 * 안에서 함께 처리하므로(원자성 확보), 저장 여부·내용은 이 RPC 호출 인자로 검증한다.
 * 더 이상 quizzes 테이블에 대한 별도 client upsert 호출이 없다.
 */
type FinalizeCallArgs = {
  p_user_id: string;
  p_note_id: string;
  p_quiz_type: string;
  p_claim_token: string;
  p_questions: unknown;
  p_history: string[][];
  p_content_hash: string;
};

function finalizeArgs(
  rpc: ReturnType<typeof setupSupabase>["rpc"],
): FinalizeCallArgs | undefined {
  return rpc.mock.calls.find(
    ([name]) => name === "finalize_quiz_generation_v2",
  )?.[1] as FinalizeCallArgs | undefined;
}

function hashOf(query: ReturnType<typeof setupSupabase>): string {
  return finalizeArgs(query.rpc)!.p_content_hash;
}

function savedHistory(query: ReturnType<typeof setupSupabase>): string[][] {
  return finalizeArgs(query.rpc)!.p_history;
}

beforeEach(() => {
  vi.clearAllMocks();
  createAiRunMock.mockResolvedValue(AI_RUN);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generateQuiz", () => {
  describe("입력 검증", () => {
    it("noteId가 uuid가 아니면 거부한다", async () => {
      const result = await generateQuiz("not-a-uuid", "ox");

      expect(result).toEqual({ error: "유효하지 않은 노트입니다." });
      expect(createClientMock).not.toHaveBeenCalled();
    });

    it("허용되지 않은 quizType은 거부한다", async () => {
      const result = await generateQuiz(NOTE_ID, "essay");

      expect(result).toEqual({ error: "유효하지 않은 퀴즈 유형입니다." });
      expect(createClientMock).not.toHaveBeenCalled();
    });

    it("quizType 검증 실패 시 AI를 호출하지 않는다", async () => {
      await generateQuiz(NOTE_ID, "");

      expect(generateJsonMock).not.toHaveBeenCalled();
    });
  });

  describe("권한", () => {
    it("로그인하지 않았으면 거부한다", async () => {
      setupSupabase({ userId: null });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({ error: "로그인이 필요합니다." });
      expect(generateJsonMock).not.toHaveBeenCalled();
    });

    it("본인 노트가 아니면 거부한다", async () => {
      setupSupabase({ note: null });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({ error: "노트를 찾을 수 없습니다." });
      expect(generateJsonMock).not.toHaveBeenCalled();
    });

    it("노트 조회에 user_id 조건을 건다", async () => {
      const query = setupSupabase({ note: null });

      await generateQuiz(NOTE_ID, "ox");

      expect(query.callsFor("notes")).toContainEqual(["eq", ["id", NOTE_ID]]);
      expect(query.callsFor("notes")).toContainEqual([
        "eq",
        ["user_id", USER_ID],
      ]);
    });
  });

  describe("캐시", () => {
    it("해시가 일치하면 AI를 호출하지 않고 캐시를 반환한다", async () => {
      // 캐시 키를 모르므로 먼저 생성해서 저장된 해시를 얻는다.
      const first = setupSupabase();
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const savedHash = hashOf(first);

      vi.clearAllMocks();

      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: savedHash,
        },
      });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(generateJsonMock).not.toHaveBeenCalled();
      expect(createAiRunMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: { questions: aiQuestions.questions, isNew: false },
      });
    });

    it("해시가 다르면 새로 생성한다", async () => {
      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: "stale-hash:ox",
        },
      });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(generateJsonMock).toHaveBeenCalledOnce();
      expect(result).toEqual({
        data: { questions: aiQuestions.questions, isNew: true },
      });
    });

    it("캐시에 다른 유형의 문항이 들어 있으면 새로 생성한다", async () => {
      const first = setupSupabase();
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const savedHash = hashOf(first);

      vi.clearAllMocks();

      // 유형 검증이 없던 시절에 저장된 행을 가정한다.
      setupSupabase({
        cached: {
          questions: [
            {
              type: "blank",
              question: "____는 산술 연산을 담당한다.",
              answer: "ALU",
              acceptedAnswers: [],
              explanation: "ALU다.",
            },
          ],
          note_content_hash: savedHash,
        },
      });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(generateJsonMock).toHaveBeenCalledOnce();
      expect(result).toEqual({
        data: { questions: aiQuestions.questions, isNew: true },
      });
    });

    it("제목만 바뀌어도 캐시 키가 달라진다", async () => {
      const first = setupSupabase({
        note: { title: "제목1", content: "내용" },
      });
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const second = setupSupabase({
        note: { title: "제목2", content: "내용" },
      });
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      expect(hashOf(first)).not.toBe(hashOf(second));
    });

    it("캐시를 노트·유형 조합으로 조회한다", async () => {
      const query = setupSupabase();
      mockAiSuccess();

      await generateQuiz(NOTE_ID, "ox");

      expect(query.callsFor("quizzes")).toContainEqual([
        "eq",
        ["note_id", NOTE_ID],
      ]);
      expect(query.callsFor("quizzes")).toContainEqual([
        "eq",
        ["quiz_type", "ox"],
      ]);
    });

    it("퀴즈 유형을 별도 행으로 저장한다", async () => {
      const query = setupSupabase();
      mockAiSuccess();

      await generateQuiz(NOTE_ID, "ox");

      expect(finalizeArgs(query.rpc)).toMatchObject({
        p_note_id: NOTE_ID,
        p_quiz_type: "ox",
      });
    });

    it("유형이 달라도 내용이 같으면 같은 해시를 쓴다", async () => {
      const first = setupSupabase();
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const second = setupSupabase();
      mockAiSuccess({
        questions: [
          {
            type: "blank",
            question: "____는 산술 연산을 담당한다.",
            answer: "ALU",
            acceptedAnswers: [],
            explanation: "ALU다.",
          },
        ],
      });
      await generateQuiz(NOTE_ID, "blank");

      expect(hashOf(first)).toBe(hashOf(second));
    });
  });

  describe("응답 스키마", () => {
    it("액션 진입 시각 기준 60초 deadline을 AI 호출에 전달한다", async () => {
      setupSupabase();
      mockAiSuccess();

      const base = Date.now();
      const nowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValueOnce(base)
        .mockReturnValue(base + 5_000);
      const timeoutSpy = vi.spyOn(AbortSignal, "timeout");

      await generateQuiz(NOTE_ID, "ox");

      expect(timeoutSpy).toHaveBeenCalledWith(55_000);
      expect(aiRequest().abortSignal).toBeInstanceOf(AbortSignal);

      timeoutSpy.mockRestore();
      nowSpy.mockRestore();
    });

    it("응답 스키마를 함께 넘겨 형식을 강제한다", async () => {
      setupSupabase();
      mockAiSuccess();

      await generateQuiz(NOTE_ID, "ox");

      // 프롬프트만으로 지시하면 유형·필드가 어긋난 응답이 나온다. 디코딩 단계에서 막는다.
      expect(aiRequest().responseSchema).toMatchObject({ type: "object" });
    });

    it("요청한 유형을 응답 스키마로 고정한다", async () => {
      setupSupabase();
      mockAiSuccess();

      await generateQuiz(NOTE_ID, "ox");

      expect(responseQuestionType()).toEqual({
        type: "string",
        enum: ["ox"],
      });
    });

    it("유형이 다르면 다른 스키마를 보낸다", async () => {
      setupSupabase();
      mockAiSuccess({
        questions: [
          {
            type: "blank",
            question: "____는 산술 연산을 담당한다.",
            answer: "ALU",
            acceptedAnswers: [],
            explanation: "ALU다.",
          },
        ],
      });

      await generateQuiz(NOTE_ID, "blank");

      expect(responseQuestionType()).toEqual({
        type: "string",
        enum: ["blank"],
      });
    });
  });

  describe("AI 실패", () => {
    it("API 호출이 실패하면 에러를 반환하고 저장하지 않는다", async () => {
      const query = setupSupabase();
      generateJsonMock.mockRejectedValue(new Error("boom"));

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(rpcNames(query.rpc)).not.toContain("finalize_quiz_generation_v2");
      expect(completeAiRunFailedMock).toHaveBeenCalledOnce();
      expect(completeAiRunFailedMock).toHaveBeenCalledWith(
        expect.objectContaining({ aiRun: AI_RUN }),
      );
      expect(completeAiRunSucceededMock).not.toHaveBeenCalled();
    });

    it("JSON이 아니면 에러를 반환하고 저장하지 않는다", async () => {
      const query = setupSupabase();
      generateJsonMock.mockResolvedValue("not json");

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
      });
      expect(rpcNames(query.rpc)).not.toContain("finalize_quiz_generation_v2");
      const terminalInput = completeAiRunFailedMock.mock.calls[0]?.[0] as {
        aiRun: AiRunPersistenceHandle;
        buildSnapshot: () => unknown;
      };
      expect(terminalInput.aiRun).toEqual(AI_RUN);
      expect(terminalInput.buildSnapshot()).toMatchObject({
        parseAndValidation: {
          error: { message: "JSON parse failed" },
        },
      });
    });

    it("스키마에 맞지 않으면 에러를 반환한다", async () => {
      setupSupabase();
      mockAiSuccess({ questions: [{ type: "ox", question: "" }] });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
      });
    });

    it("요청한 유형과 다른 문항이 오면 저장하지 않는다", async () => {
      const query = setupSupabase();
      mockAiSuccess({
        questions: [
          {
            type: "choice",
            question: "산술 연산 장치는?",
            options: ["ALU", "PC", "IR", "MAR"],
            answer: 0,
            explanation: "ALU다.",
          },
        ],
      });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
      });
      expect(rpcNames(query.rpc)).not.toContain("finalize_quiz_generation_v2");
    });

    it("한 문항만 유형이 달라도 세트 전체를 거부한다", async () => {
      const query = setupSupabase();
      mockAiSuccess({
        questions: [
          ...aiQuestions.questions,
          {
            type: "blank",
            question: "____는 산술 연산을 담당한다.",
            answer: "ALU",
            acceptedAnswers: [],
            explanation: "ALU다.",
          },
        ],
      });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
      });
      expect(rpcNames(query.rpc)).not.toContain("finalize_quiz_generation_v2");
    });

    it("응답 원문을 로그에 남기지 않는다", async () => {
      setupSupabase();
      const secret = "노트에만 있는 비밀 문장";
      generateJsonMock.mockResolvedValue(secret);

      await generateQuiz(NOTE_ID, "ox");

      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).not.toContain(secret);
    });
  });

  describe("사용량 제한", () => {
    it("짧은 시간에 너무 많이 요청하면 AI를 호출하지 않는다", async () => {
      setupSupabase({ claimResult: "too_many_requests" });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(generateJsonMock).not.toHaveBeenCalled();
      expect(createAiRunMock).not.toHaveBeenCalled();
    });

    it("일일 한도를 넘으면 AI를 호출하지 않는다", async () => {
      setupSupabase({ claimResult: "daily_exceeded" });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error:
          "오늘 AI 퀴즈 생성 횟수를 모두 사용했습니다. 기존 퀴즈는 다시 풀 수 있어요.",
      });
      expect(generateJsonMock).not.toHaveBeenCalled();
    });

    it("같은 노트·유형을 연속 요청하면 거부한다", async () => {
      setupSupabase({ claimResult: "in_flight" });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈를 만들고 있습니다. 잠시만 기다려주세요.",
      });
      expect(generateJsonMock).not.toHaveBeenCalled();
    });

    it("캐시가 적중하면 사용량을 선점하지 않는다", async () => {
      const first = setupSupabase();
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const savedHash = hashOf(first);

      vi.clearAllMocks();

      const second = setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: savedHash,
        },
      });

      await generateQuiz(NOTE_ID, "ox");

      expect(rpcNames(second.rpc)).not.toContain("claim_quiz_generation_v2");
    });

    it("캐시 조회가 실패하면 사용량을 선점하지 않는다", async () => {
      const query = setupSupabase({
        cacheError: { message: "cache read failed" },
      });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(rpcNames(query.rpc)).not.toContain("claim_quiz_generation_v2");
      expect(generateJsonMock).not.toHaveBeenCalled();
    });

    it("AI 호출 시간이 부족하면 사용량을 선점하지 않는다", async () => {
      const query = setupSupabase();
      const base = Date.now();
      const nowSpy = vi
        .spyOn(Date, "now")
        .mockReturnValueOnce(base)
        .mockReturnValue(base + 50_000);

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.",
      });
      expect(rpcNames(query.rpc)).not.toContain("claim_quiz_generation_v2");
      expect(generateJsonMock).not.toHaveBeenCalled();

      nowSpy.mockRestore();
    });

    it("AI 호출이 실패해도 사용량을 되돌리지 않는다", async () => {
      const query = setupSupabase();
      generateJsonMock.mockRejectedValue(new Error("boom"));

      await generateQuiz(NOTE_ID, "ox");

      // 되돌리는 RPC가 있으면 사용자가 직접 호출해 한도를 무력화할 수 있다.
      // finalize는 Zod 검증까지 통과해야 불리므로 여기서는 claim만 호출된다.
      expect(rpcNames(query.rpc)).toEqual(["claim_quiz_generation_v2"]);
    });

    it("응답 파싱에 실패해도 사용량을 되돌리지 않는다", async () => {
      const query = setupSupabase();
      generateJsonMock.mockResolvedValue("not json");

      await generateQuiz(NOTE_ID, "ox");

      expect(rpcNames(query.rpc)).toEqual(["claim_quiz_generation_v2"]);
    });

    it("사용량 조회 자체가 실패하면 생성 실패로 처리한다", async () => {
      setupSupabase({ claimError: { message: "db down" } });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(generateJsonMock).not.toHaveBeenCalled();
    });

    it("재생성도 같은 한도를 사용한다", async () => {
      setupSupabase({ claimResult: "daily_exceeded" });

      const result = await regenerateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error:
          "오늘 AI 퀴즈 생성 횟수를 모두 사용했습니다. 기존 퀴즈는 다시 풀 수 있어요.",
      });
      expect(generateJsonMock).not.toHaveBeenCalled();
    });
  });

  describe("생성 확정 (finalize)", () => {
    it("finalize가 ok면 캐시 내용과 함께 확정을 요청하고 퀴즈를 반환한다", async () => {
      const query = setupSupabase({ finalizeResult: "ok" });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      // 저장(quizzes upsert)은 이제 finalize RPC 트랜잭션 안에서 원자적으로
      // 처리된다 — completed_at 갱신과 캐시 저장 사이의 창을 없애기 위해서다
      // (그 사이 다음 세대가 먼저 저장을 끝내면 이 세대의 저장이 최신 결과를
      // 덮어쓸 수 있었다). 그래서 여기서는 RPC에 넘긴 인자로 검증한다.
      expect(finalizeArgs(query.rpc)).toMatchObject({
        p_note_id: NOTE_ID,
        p_quiz_type: "ox",
        p_content_hash: expect.any(String),
      });
      expect(result).toEqual({
        data: { questions: aiQuestions.questions, isNew: true },
      });
      expect(completeAiRunSucceededMock).toHaveBeenCalledWith(
        expect.objectContaining({
          aiRun: AI_RUN,
          featureResultIds: [QUIZ_ID],
        }),
      );
      const terminalInput = completeAiRunSucceededMock.mock.calls[0]?.[0] as {
        aiRun: AiRunPersistenceHandle;
        buildSnapshot: () => unknown;
      };
      expect(terminalInput.aiRun).toEqual(AI_RUN);
      expect(terminalInput.buildSnapshot()).toMatchObject({
        quizGeneration: {
          output: {
            responseText: JSON.stringify(aiQuestions),
            providerMetadata: { finishReason: "stop" },
          },
        },
        finalOutput: { questions: aiQuestions.questions },
      });
    });

    it("finalize가 already_completed면 멱등 성공으로 반환한다", async () => {
      const query = setupSupabase({ finalizeResult: "already_completed" });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(rpcNames(query.rpc)).toContain("finalize_quiz_generation_v2");
      expect(result).toEqual({
        data: { questions: aiQuestions.questions, isNew: true },
      });
      expect(completeAiRunSucceededMock).toHaveBeenCalledWith(
        expect.objectContaining({
          aiRun: AI_RUN,
          featureResultIds: [QUIZ_ID],
        }),
      );
    });

    it("finalize가 stale_claim이면 에러를 반환한다", async () => {
      setupSupabase({ finalizeResult: "stale_claim" });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error:
          "다른 퀴즈 생성 요청이 먼저 진행됐어요. 잠시 후 다시 시도해주세요.",
      });
      expect(completeAiRunSucceededMock).toHaveBeenCalledWith(
        expect.objectContaining({
          aiRun: AI_RUN,
          featureResultIds: [],
        }),
      );
      expect(completeAiRunFailedMock).not.toHaveBeenCalled();
    });

    it("finalize가 예상 밖 상태를 반환해도 이미 받은 퀴즈는 반환한다", async () => {
      // not_found 등은 정상 경로에서 나오지 않지만, 나오더라도 캐시만 저장하지 않을 뿐
      // AI가 이미 만든 유효한 퀴즈까지 버리지는 않는다.
      setupSupabase({ finalizeResult: "not_found" });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        data: { questions: aiQuestions.questions, isNew: true },
      });
      expect(console.error).toHaveBeenCalled();
    });

    it("finalize RPC 통신 자체가 실패해도 이미 받은 퀴즈는 반환한다", async () => {
      setupSupabase({
        finalizeError: { message: "network error" },
      });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        data: { questions: aiQuestions.questions, isNew: true },
      });
      expect(console.error).toHaveBeenCalled();
      expect(completeAiRunSucceededMock).toHaveBeenCalledWith(
        expect.objectContaining({
          aiRun: AI_RUN,
          featureResultIds: [],
        }),
      );
    });

    it("claim 응답 형식이 올바르지 않으면 생성 실패로 처리한다", async () => {
      setupSupabase({ claimResult: { status: "ok" } });
      mockAiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(generateJsonMock).not.toHaveBeenCalled();
    });
  });
});

describe("regenerateQuiz", () => {
  it("캐시가 일치해도 무시하고 새로 생성한다", async () => {
    const first = setupSupabase();
    mockAiSuccess();
    await generateQuiz(NOTE_ID, "ox");

    const savedHash = hashOf(first);

    vi.clearAllMocks();

    setupSupabase({
      cached: {
        questions: aiQuestions.questions,
        note_content_hash: savedHash,
      },
    });
    mockAiSuccess();

    const result = await regenerateQuiz(NOTE_ID, "ox");

    expect(generateJsonMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: { questions: aiQuestions.questions, isNew: true },
    });
    const createInput = createAiRunMock.mock.calls[0]?.[0] as {
      buildSnapshot: () => unknown;
      featureType: string;
    };
    expect(createInput.featureType).toBe("quiz-generation");
    expect(createInput.buildSnapshot()).toMatchObject({
      sourceInput: { input: { action: "regenerate" } },
    });
  });

  it("기존 캐시를 미리 삭제하지 않는다", async () => {
    const query = setupSupabase();
    generateJsonMock.mockRejectedValue(new Error("boom"));

    await regenerateQuiz(NOTE_ID, "ox");

    expect(methodNames(query.callsFor("quizzes"))).not.toContain("delete");
  });

  it("허용되지 않은 quizType은 거부한다", async () => {
    const result = await regenerateQuiz(NOTE_ID, "essay");

    expect(result).toEqual({ error: "유효하지 않은 퀴즈 유형입니다." });
  });

  describe("같은 퀴즈 반복 방지", () => {
    /** 캐시 키를 모르므로 한 번 생성해서 저장된 해시를 얻는다. */
    async function savedHash(): Promise<string> {
      const query = setupSupabase();
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const hash = hashOf(query);
      vi.clearAllMocks();

      return hash;
    }

    it("직전에 낸 문제를 프롬프트에 넣어 재출제를 막는다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["1회차 문제"]],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(aiRequest().prompt).toContain("## 이미 출제된 문제");
      expect(aiRequest().prompt).toContain("1회차 문제");
    });

    it("여러 회차의 문제를 함께 넣는다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["3회차 문제"], ["2회차 문제"], ["1회차 문제"]],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      const prompt = aiRequest().prompt;
      expect(prompt).toContain("3회차 문제");
      expect(prompt).toContain("2회차 문제");
      expect(prompt).toContain("1회차 문제");
    });

    it("같은 문제가 여러 회차에 있어도 한 번만 넣는다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["겹치는 문제"], ["겹치는 문제"]],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      const occurrences = aiRequest().prompt.split("겹치는 문제").length - 1;
      expect(occurrences).toBe(1);
    });

    it("이력이 길면 최신 회차부터 상한까지만 넣는다", async () => {
      const hash = await savedHash();
      const makeSet = (prefix: string) =>
        Array.from({ length: 25 }, (_, i) => `${prefix}문제${i}`);

      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [makeSet("최신"), makeSet("오래된")],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      // 상한(45)에 걸려 잘리는 것은 항상 오래된 회차 쪽이어야 한다.
      const prompt = aiRequest().prompt;
      expect(prompt).toContain("최신문제24");
      expect(prompt).toContain("오래된문제0");
      expect(prompt).not.toContain("오래된문제24");
      const createInput = createAiRunMock.mock.calls[0]?.[0] as {
        buildSnapshot: () => {
          generationInput: { output: { previousQuestions: string[] } };
        };
      };
      expect(
        createInput.buildSnapshot().generationInput.output.previousQuestions,
      ).toHaveLength(45);
    });

    it("이력 형식이 깨져 있으면 이전 문제 없이 생성한다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: hash,
          recent_questions: { broken: true },
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(aiRequest().prompt).not.toContain("## 이미 출제된 문제");
    });

    it("노트가 바뀌어 해시가 다르면 이전 문제를 넣지 않는다", async () => {
      setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: "stale-hash",
          recent_questions: [["옛 노트에서 낸 문제"]],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(aiRequest().prompt).not.toContain("## 이미 출제된 문제");
    });

    it("캐시가 없으면 이전 문제 없이 생성한다", async () => {
      setupSupabase();
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(aiRequest().prompt).not.toContain("## 이미 출제된 문제");
    });

    it("재생성은 최초 생성보다 높은 temperature를 쓴다", async () => {
      setupSupabase();
      mockAiSuccess();
      await generateQuiz(NOTE_ID, "ox");
      const initial = aiRequest().temperature;

      vi.clearAllMocks();

      setupSupabase();
      mockAiSuccess();
      await regenerateQuiz(NOTE_ID, "ox");

      expect(aiRequest().temperature).toBeGreaterThan(initial);
    });

    it("이번 세트를 이력 맨 앞에 쌓는다", async () => {
      const hash = await savedHash();

      const query = setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["2회차 문제"], ["1회차 문제"]],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(savedHistory(query)).toEqual([
        [aiQuestions.questions[0]!.question],
        ["2회차 문제"],
        ["1회차 문제"],
      ]);
    });

    it("이력은 최근 3세트까지만 남긴다", async () => {
      const hash = await savedHash();

      const query = setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["3회차 문제"], ["2회차 문제"], ["1회차 문제"]],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      const history = savedHistory(query);
      expect(history).toHaveLength(3);
      expect(history).not.toContainEqual(["1회차 문제"]);
    });

    it("노트가 바뀌면 이력을 이번 세트만 남기고 비운다", async () => {
      const query = setupSupabase({
        cached: {
          questions: aiQuestions.questions,
          note_content_hash: "stale-hash",
          recent_questions: [["옛 노트에서 낸 문제"]],
        },
      });
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(savedHistory(query)).toEqual([
        [aiQuestions.questions[0]!.question],
      ]);
    });

    it("요청마다 출제 관점을 프롬프트에 넣는다", async () => {
      setupSupabase();
      mockAiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(aiRequest().prompt).toContain("## 이번 출제 관점");
    });
  });
});
