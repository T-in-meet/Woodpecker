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
  cached?: { questions: unknown; note_content_hash: string } | null;
  upsertError?: { message: string } | null;
};

function setupSupabase(input: SupabaseMockInput = {}) {
  const {
    userId = USER_ID,
    note = { title: "제목", content: "내용" },
    cached = null,
    upsertError = null,
  } = input;

  const query = createSupabaseQueryMock({
    notes: { data: note },
    quizzes: { data: cached, error: upsertError },
  });

  const getUser = vi.fn().mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
  });

  createClientMock.mockResolvedValue({
    ...query.supabase,
    auth: { getUser },
  });

  return query;
}

function mockGeminiSuccess(payload: unknown = geminiQuestions) {
  generateContentMock.mockResolvedValue({ text: JSON.stringify(payload) });
}

function methodNames(calls: [string, unknown[]][]): string[] {
  return calls.map(([method]) => method);
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

      const upsertCall = first
        .callsFor("quizzes")
        .find(([method]) => method === "upsert");
      const savedHash = (upsertCall?.[1][0] as { note_content_hash: string })
        .note_content_hash;

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

      const hashOf = (query: ReturnType<typeof setupSupabase>) =>
        (
          query
            .callsFor("quizzes")
            .find(([method]) => method === "upsert")?.[1][0] as {
            note_content_hash: string;
          }
        ).note_content_hash;

      expect(hashOf(first)).not.toBe(hashOf(second));
    });

    it("퀴즈 유형이 다르면 캐시 키가 달라진다", async () => {
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

      const hashOf = (query: ReturnType<typeof setupSupabase>) =>
        (
          query
            .callsFor("quizzes")
            .find(([method]) => method === "upsert")?.[1][0] as {
            note_content_hash: string;
          }
        ).note_content_hash;

      expect(hashOf(first)).not.toBe(hashOf(second));
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

    it("응답 원문을 로그에 남기지 않는다", async () => {
      setupSupabase();
      const secret = "노트에만 있는 비밀 문장";
      generateContentMock.mockResolvedValue({ text: secret });

      await generateQuiz(NOTE_ID, "ox");

      const logged = vi.mocked(console.error).mock.calls.flat().join(" ");
      expect(logged).not.toContain(secret);
    });
  });

  describe("저장", () => {
    it("note_id 충돌 시 upsert하도록 지정한다", async () => {
      const query = setupSupabase();
      mockGeminiSuccess();

      await generateQuiz(NOTE_ID, "ox");

      const upsertCall = query
        .callsFor("quizzes")
        .find(([method]) => method === "upsert");

      expect(upsertCall?.[1][1]).toEqual({ onConflict: "note_id" });
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

    const savedHash = (
      first
        .callsFor("quizzes")
        .find(([method]) => method === "upsert")?.[1][0] as {
        note_content_hash: string;
      }
    ).note_content_hash;

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
});
