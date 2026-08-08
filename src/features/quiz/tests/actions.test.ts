import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSupabaseQueryMock } from "@/tests/supabaseQueryMock";

const { createClientMock, generateContentMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  generateContentMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/gemini/client", () => ({
  getGemini: () => ({ models: { generateContent: generateContentMock } }),
}));

const { generateQuiz, regenerateQuiz } = await import("../actions");

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-123";

const geminiQuestions = {
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
  upsertError?: { message: string } | null;
  claimResult?: string;
  claimError?: { message: string } | null;
};

function setupSupabase(input: SupabaseMockInput = {}) {
  const {
    userId = USER_ID,
    note = { title: "제목", content: "내용" },
    cached = null,
    upsertError = null,
    claimResult = "ok",
    claimError = null,
  } = input;

  const query = createSupabaseQueryMock({
    notes: { data: note },
    quizzes: { data: cached, error: upsertError },
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  });

  const rpc = vi.fn((name: string) => {
    if (name === "claim_quiz_generation") {
      return Promise.resolve({ data: claimResult, error: claimError });
    }

    return Promise.resolve({ data: null, error: null });
  });

  createClientMock.mockResolvedValue({
    ...query.supabase,
    auth: { getUser },
    rpc,
  });

  return { ...query, rpc };
}

function rpcNames(rpc: ReturnType<typeof setupSupabase>["rpc"]): string[] {
  return rpc.mock.calls.map(([name]) => name);
}

function mockGeminiSuccess(payload: unknown = geminiQuestions) {
  generateContentMock.mockResolvedValue({ text: JSON.stringify(payload) });
}

function methodNames(calls: [string, unknown[]][]): string[] {
  return calls.map(([method]) => method);
}

function geminiRequest(): {
  contents: string;
  config: { temperature: number };
} {
  return generateContentMock.mock.calls[0]?.[0] as {
    contents: string;
    config: { temperature: number };
  };
}

function upsertPayload(query: ReturnType<typeof setupSupabase>) {
  return query.callsFor("quizzes").find(([method]) => method === "upsert")?.[1];
}

function hashOf(query: ReturnType<typeof setupSupabase>): string {
  return (upsertPayload(query)?.[0] as { note_content_hash: string })
    .note_content_hash;
}

function savedHistory(query: ReturnType<typeof setupSupabase>): string[][] {
  return (upsertPayload(query)?.[0] as { recent_questions: string[][] })
    .recent_questions;
}

beforeEach(() => {
  vi.clearAllMocks();
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

    it("quizType 검증 실패 시 Gemini를 호출하지 않는다", async () => {
      await generateQuiz(NOTE_ID, "");

      expect(generateContentMock).not.toHaveBeenCalled();
    });
  });

  describe("권한", () => {
    it("로그인하지 않았으면 거부한다", async () => {
      setupSupabase({ userId: null });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({ error: "로그인이 필요합니다." });
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("본인 노트가 아니면 거부한다", async () => {
      setupSupabase({ note: null });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({ error: "노트를 찾을 수 없습니다." });
      expect(generateContentMock).not.toHaveBeenCalled();
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
    it("해시가 일치하면 Gemini를 호출하지 않고 캐시를 반환한다", async () => {
      // 캐시 키를 모르므로 먼저 생성해서 저장된 해시를 얻는다.
      const first = setupSupabase();
      mockGeminiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const savedHash = hashOf(first);

      vi.clearAllMocks();

      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: savedHash,
        },
      });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(generateContentMock).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: { questions: geminiQuestions.questions, isNew: false },
      });
    });

    it("해시가 다르면 새로 생성한다", async () => {
      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: "stale-hash:ox",
        },
      });
      mockGeminiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(generateContentMock).toHaveBeenCalledOnce();
      expect(result).toEqual({
        data: { questions: geminiQuestions.questions, isNew: true },
      });
    });

    it("캐시에 다른 유형의 문항이 들어 있으면 새로 생성한다", async () => {
      const first = setupSupabase();
      mockGeminiSuccess();
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
      mockGeminiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(generateContentMock).toHaveBeenCalledOnce();
      expect(result).toEqual({
        data: { questions: geminiQuestions.questions, isNew: true },
      });
    });

    it("제목만 바뀌어도 캐시 키가 달라진다", async () => {
      const first = setupSupabase({
        note: { title: "제목1", content: "내용" },
      });
      mockGeminiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const second = setupSupabase({
        note: { title: "제목2", content: "내용" },
      });
      mockGeminiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      expect(hashOf(first)).not.toBe(hashOf(second));
    });

    it("캐시를 노트·유형 조합으로 조회한다", async () => {
      const query = setupSupabase();
      mockGeminiSuccess();

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
      mockGeminiSuccess();

      await generateQuiz(NOTE_ID, "ox");

      const upsertCall = query
        .callsFor("quizzes")
        .find(([method]) => method === "upsert");

      expect(upsertCall?.[1][0]).toMatchObject({
        note_id: NOTE_ID,
        quiz_type: "ox",
      });
    });

    it("유형이 달라도 내용이 같으면 같은 해시를 쓴다", async () => {
      const first = setupSupabase();
      mockGeminiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const second = setupSupabase();
      mockGeminiSuccess({
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

  describe("Gemini 실패", () => {
    it("API 호출이 실패하면 에러를 반환하고 저장하지 않는다", async () => {
      const query = setupSupabase();
      generateContentMock.mockRejectedValue(new Error("boom"));

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(methodNames(query.callsFor("quizzes"))).not.toContain("upsert");
    });

    it("JSON이 아니면 에러를 반환하고 저장하지 않는다", async () => {
      const query = setupSupabase();
      generateContentMock.mockResolvedValue({ text: "not json" });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
      });
      expect(methodNames(query.callsFor("quizzes"))).not.toContain("upsert");
    });

    it("스키마에 맞지 않으면 에러를 반환한다", async () => {
      setupSupabase();
      mockGeminiSuccess({ questions: [{ type: "ox", question: "" }] });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성 결과를 처리할 수 없습니다. 다시 시도해주세요.",
      });
    });

    it("요청한 유형과 다른 문항이 오면 저장하지 않는다", async () => {
      const query = setupSupabase();
      mockGeminiSuccess({
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
      expect(methodNames(query.callsFor("quizzes"))).not.toContain("upsert");
    });

    it("한 문항만 유형이 달라도 세트 전체를 거부한다", async () => {
      const query = setupSupabase();
      mockGeminiSuccess({
        questions: [
          ...geminiQuestions.questions,
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
      expect(methodNames(query.callsFor("quizzes"))).not.toContain("upsert");
    });

    it("응답 원문을 로그에 남기지 않는다", async () => {
      setupSupabase();
      const secret = "노트에만 있는 비밀 문장";
      generateContentMock.mockResolvedValue({ text: secret });

      await generateQuiz(NOTE_ID, "ox");

      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).not.toContain(secret);
    });
  });

  describe("사용량 제한", () => {
    it("일일 한도를 넘으면 Gemini를 호출하지 않는다", async () => {
      setupSupabase({ claimResult: "daily_exceeded" });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error:
          "오늘 만들 수 있는 퀴즈를 모두 사용했습니다. 내일 다시 시도해주세요.",
      });
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("짧은 시간에 너무 많이 요청하면 거부한다", async () => {
      setupSupabase({ claimResult: "too_many_requests" });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("같은 노트·유형을 연속 요청하면 거부한다", async () => {
      setupSupabase({ claimResult: "in_flight" });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈를 만들고 있습니다. 잠시만 기다려주세요.",
      });
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("캐시가 적중하면 사용량을 선점하지 않는다", async () => {
      const first = setupSupabase();
      mockGeminiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const savedHash = hashOf(first);

      vi.clearAllMocks();

      const second = setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: savedHash,
        },
      });

      await generateQuiz(NOTE_ID, "ox");

      expect(rpcNames(second.rpc)).not.toContain("claim_quiz_generation");
    });

    it("Gemini 호출이 실패해도 사용량을 되돌리지 않는다", async () => {
      const query = setupSupabase();
      generateContentMock.mockRejectedValue(new Error("boom"));

      await generateQuiz(NOTE_ID, "ox");

      // 되돌리는 RPC가 있으면 사용자가 직접 호출해 한도를 무력화할 수 있다.
      expect(rpcNames(query.rpc)).toEqual(["claim_quiz_generation"]);
    });

    it("응답 파싱에 실패해도 사용량을 되돌리지 않는다", async () => {
      const query = setupSupabase();
      generateContentMock.mockResolvedValue({ text: "not json" });

      await generateQuiz(NOTE_ID, "ox");

      expect(rpcNames(query.rpc)).toEqual(["claim_quiz_generation"]);
    });

    it("사용량 조회 자체가 실패하면 생성 실패로 처리한다", async () => {
      setupSupabase({ claimError: { message: "db down" } });

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error: "퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.",
      });
      expect(generateContentMock).not.toHaveBeenCalled();
    });

    it("재생성도 같은 한도를 사용한다", async () => {
      setupSupabase({ claimResult: "daily_exceeded" });

      const result = await regenerateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        error:
          "오늘 만들 수 있는 퀴즈를 모두 사용했습니다. 내일 다시 시도해주세요.",
      });
      expect(generateContentMock).not.toHaveBeenCalled();
    });
  });

  describe("저장", () => {
    it("note_id 충돌 시 upsert하도록 지정한다", async () => {
      const query = setupSupabase();
      mockGeminiSuccess();

      await generateQuiz(NOTE_ID, "ox");

      expect(upsertPayload(query)?.[1]).toEqual({
        onConflict: "note_id,quiz_type",
      });
    });

    it("저장에 실패해도 생성된 퀴즈는 반환한다", async () => {
      setupSupabase({ upsertError: { message: "duplicate key" } });
      mockGeminiSuccess();

      const result = await generateQuiz(NOTE_ID, "ox");

      expect(result).toEqual({
        data: { questions: geminiQuestions.questions, isNew: true },
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
});

describe("regenerateQuiz", () => {
  it("캐시가 일치해도 무시하고 새로 생성한다", async () => {
    const first = setupSupabase();
    mockGeminiSuccess();
    await generateQuiz(NOTE_ID, "ox");

    const savedHash = hashOf(first);

    vi.clearAllMocks();

    setupSupabase({
      cached: {
        questions: geminiQuestions.questions,
        note_content_hash: savedHash,
      },
    });
    mockGeminiSuccess();

    const result = await regenerateQuiz(NOTE_ID, "ox");

    expect(generateContentMock).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: { questions: geminiQuestions.questions, isNew: true },
    });
  });

  it("기존 캐시를 미리 삭제하지 않는다", async () => {
    const query = setupSupabase();
    generateContentMock.mockRejectedValue(new Error("boom"));

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
      mockGeminiSuccess();
      await generateQuiz(NOTE_ID, "ox");

      const hash = hashOf(query);
      vi.clearAllMocks();

      return hash;
    }

    it("직전에 낸 문제를 프롬프트에 넣어 재출제를 막는다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["1회차 문제"]],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(geminiRequest().contents).toContain("## 이미 출제된 문제");
      expect(geminiRequest().contents).toContain("1회차 문제");
    });

    it("여러 회차의 문제를 함께 넣는다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["3회차 문제"], ["2회차 문제"], ["1회차 문제"]],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      const prompt = geminiRequest().contents;
      expect(prompt).toContain("3회차 문제");
      expect(prompt).toContain("2회차 문제");
      expect(prompt).toContain("1회차 문제");
    });

    it("같은 문제가 여러 회차에 있어도 한 번만 넣는다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["겹치는 문제"], ["겹치는 문제"]],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      const occurrences =
        geminiRequest().contents.split("겹치는 문제").length - 1;
      expect(occurrences).toBe(1);
    });

    it("이력이 길면 최신 회차부터 상한까지만 넣는다", async () => {
      const hash = await savedHash();
      const makeSet = (prefix: string) =>
        Array.from({ length: 25 }, (_, i) => `${prefix}문제${i}`);

      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [makeSet("최신"), makeSet("오래된")],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      // 상한(45)에 걸려 잘리는 것은 항상 오래된 회차 쪽이어야 한다.
      const prompt = geminiRequest().contents;
      expect(prompt).toContain("최신문제24");
      expect(prompt).toContain("오래된문제0");
      expect(prompt).not.toContain("오래된문제24");
    });

    it("이력 형식이 깨져 있으면 이전 문제 없이 생성한다", async () => {
      const hash = await savedHash();

      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: hash,
          recent_questions: { broken: true },
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(geminiRequest().contents).not.toContain("## 이미 출제된 문제");
    });

    it("노트가 바뀌어 해시가 다르면 이전 문제를 넣지 않는다", async () => {
      setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: "stale-hash",
          recent_questions: [["옛 노트에서 낸 문제"]],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(geminiRequest().contents).not.toContain("## 이미 출제된 문제");
    });

    it("캐시가 없으면 이전 문제 없이 생성한다", async () => {
      setupSupabase();
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(geminiRequest().contents).not.toContain("## 이미 출제된 문제");
    });

    it("재생성은 최초 생성보다 높은 temperature를 쓴다", async () => {
      setupSupabase();
      mockGeminiSuccess();
      await generateQuiz(NOTE_ID, "ox");
      const initial = geminiRequest().config.temperature;

      vi.clearAllMocks();

      setupSupabase();
      mockGeminiSuccess();
      await regenerateQuiz(NOTE_ID, "ox");

      expect(geminiRequest().config.temperature).toBeGreaterThan(initial);
    });

    it("이번 세트를 이력 맨 앞에 쌓는다", async () => {
      const hash = await savedHash();

      const query = setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["2회차 문제"], ["1회차 문제"]],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(savedHistory(query)).toEqual([
        [geminiQuestions.questions[0]!.question],
        ["2회차 문제"],
        ["1회차 문제"],
      ]);
    });

    it("이력은 최근 3세트까지만 남긴다", async () => {
      const hash = await savedHash();

      const query = setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: hash,
          recent_questions: [["3회차 문제"], ["2회차 문제"], ["1회차 문제"]],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      const history = savedHistory(query);
      expect(history).toHaveLength(3);
      expect(history).not.toContainEqual(["1회차 문제"]);
    });

    it("노트가 바뀌면 이력을 이번 세트만 남기고 비운다", async () => {
      const query = setupSupabase({
        cached: {
          questions: geminiQuestions.questions,
          note_content_hash: "stale-hash",
          recent_questions: [["옛 노트에서 낸 문제"]],
        },
      });
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(savedHistory(query)).toEqual([
        [geminiQuestions.questions[0]!.question],
      ]);
    });

    it("요청마다 출제 관점을 프롬프트에 넣는다", async () => {
      setupSupabase();
      mockGeminiSuccess();

      await regenerateQuiz(NOTE_ID, "ox");

      expect(geminiRequest().contents).toContain("## 이번 출제 관점");
    });
  });
});
