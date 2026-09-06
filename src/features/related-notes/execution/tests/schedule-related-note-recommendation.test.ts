import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AiRunPersistenceHandle } from "@/features/ai/runs/types";

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => Promise<void>) => void>(),
  checkpointAiRun: vi.fn(),
  claim: vi.fn(),
  completeAiRunFailed: vi.fn(),
  completeAiRunSucceeded: vi.fn(),
  completeClaim: vi.fn(),
  createAiRun: vi.fn(),
  createAdminClient: vi.fn(),
  replace: vi.fn(),
  resolveChat: vi.fn(),
  resolveEmbedding: vi.fn(),
  run: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/features/ai/runs/persistence", () => ({
  checkpointAiRun: mocks.checkpointAiRun,
  completeAiRunFailed: mocks.completeAiRunFailed,
  completeAiRunSucceeded: mocks.completeAiRunSucceeded,
  createAiRun: mocks.createAiRun,
}));
vi.mock("@/features/ai/runtimes", () => ({
  resolveAiRuntimeChatConfiguration: mocks.resolveChat,
  resolveAiRuntimeEmbeddingConfiguration: mocks.resolveEmbedding,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));
vi.mock("../execution-claim-persistence", async () => {
  const actual = await vi.importActual<
    typeof import("../execution-claim-persistence")
  >("../execution-claim-persistence");
  return {
    ...actual,
    claimRelatedNoteRecommendationExecution: mocks.claim,
    completeRelatedNoteRecommendationExecutionClaim: mocks.completeClaim,
  };
});
vi.mock("../run-related-note-recommendation", () => ({
  runRelatedNoteRecommendation: mocks.run,
}));
vi.mock(
  "../../persistence/replace-related-note-ai-recommendations",
  async () => {
    const actual = await vi.importActual<
      typeof import("../../persistence/replace-related-note-ai-recommendations")
    >("../../persistence/replace-related-note-ai-recommendations");
    return { ...actual, replaceRelatedNoteAiRecommendations: mocks.replace };
  },
);

const { scheduleRelatedNoteRecommendation } =
  await import("../schedule-related-note-recommendation");

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOTE_ID = "22222222-2222-4222-8222-222222222222";
const CLAIM_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";
const RELATION_ID = "55555555-5555-4555-8555-555555555555";

const AI_RUN: AiRunPersistenceHandle = {
  id: RUN_ID,
  userId: USER_ID,
  featureType: "related-notes",
  startedAt: "2026-09-05T00:00:00.000Z",
};

/** 테스트에서 source Note 조회 chain을 구성합니다. */
function setupSource() {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: NOTE_ID,
      title: "제목",
      content: "내용",
      updated_at: "2026-09-05T00:00:00.000Z",
    },
    error: null,
  });
  const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mocks.createAdminClient.mockReturnValue({
    from: vi.fn().mockReturnValue(chain),
  });
}

/** 테스트용 Runtime Configuration을 생성합니다. */
function runtime(kind: "chat" | "embedding") {
  const model = {
    id: "66666666-6666-4666-8666-666666666666",
    model: "model",
    provider: "openai",
    dimensions: kind === "embedding" ? 1536 : null,
  };
  return kind === "embedding"
    ? { featureKey: "feature", roleKey: "role", kind, model }
    : {
        featureKey: "feature",
        roleKey: "role",
        kind,
        model,
        temperature: 0,
        prompt: {
          agent: { id: "77777777-7777-4777-8777-777777777777" },
          family: { id: "88888888-8888-4888-8888-888888888888" },
          version: { id: "99999999-9999-4999-8999-999999999999" },
        },
      };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupSource();
  mocks.after.mockImplementation((callback) => void callback());
  mocks.claim.mockResolvedValue({ claimId: CLAIM_ID, status: "claimed" });
  mocks.resolveEmbedding.mockResolvedValue(runtime("embedding"));
  mocks.resolveChat.mockResolvedValue(runtime("chat"));
  mocks.createAiRun.mockResolvedValue(AI_RUN);
  mocks.run.mockImplementation(
    async (params: {
      snapshotAccumulator: { completeFinalOutput: (items: unknown[]) => void };
    }) => {
      params.snapshotAccumulator.completeFinalOutput([]);
      return { recommendations: [] };
    },
  );
  mocks.replace.mockResolvedValue({
    status: "replaced",
    relationIds: [RELATION_ID],
  });
});

describe("scheduleRelatedNoteRecommendation", () => {
  it("claim과 Runtime 확정 뒤 Related Notes AI Run을 생성하고 저장 relation ID로 성공 완료한다", async () => {
    await scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: USER_ID,
    });

    await vi.waitFor(() =>
      expect(mocks.completeAiRunSucceeded).toHaveBeenCalled(),
    );
    expect(mocks.createAiRun).toHaveBeenCalledWith(
      expect.objectContaining({
        featureType: "related-notes",
        userId: USER_ID,
      }),
    );
    const createInput = mocks.createAiRun.mock.calls[0]?.[0] as {
      buildSnapshot: () => unknown;
    };
    expect(createInput.buildSnapshot()).toMatchObject({
      sourceInput: {
        input: { note: { id: NOTE_ID, title: "제목", content: "내용" } },
      },
    });
    expect(mocks.completeAiRunSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun: AI_RUN,
        featureResultIds: [RELATION_ID],
      }),
    );
    expect(mocks.completeAiRunFailed).not.toHaveBeenCalled();
  });

  it("duplicate claim에는 Runtime 또는 AI Run을 생성하지 않는다", async () => {
    mocks.claim.mockResolvedValue({ claimId: CLAIM_ID, status: "duplicate" });
    await scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: USER_ID,
    });
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.resolveChat).not.toHaveBeenCalled();
    expect(mocks.createAiRun).not.toHaveBeenCalled();
  });

  it("after 등록 실패 시 획득한 claim을 failed로 정리하고 오류를 전파한다", async () => {
    const registrationError = new Error("after registration failed");

    mocks.after.mockImplementationOnce(() => {
      throw registrationError;
    });

    await expect(
      scheduleRelatedNoteRecommendation({
        noteId: NOTE_ID,
        ownerUserId: USER_ID,
      }),
    ).rejects.toBe(registrationError);

    expect(mocks.completeClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      status: "failed",
      userId: USER_ID,
    });

    expect(mocks.resolveEmbedding).not.toHaveBeenCalled();
    expect(mocks.resolveChat).not.toHaveBeenCalled();
    expect(mocks.createAiRun).not.toHaveBeenCalled();
  });

  it("AI processing 실패는 failed terminal과 failed claim으로 완료한다", async () => {
    mocks.run.mockRejectedValue(new Error("provider failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: USER_ID,
    });
    await vi.waitFor(() =>
      expect(mocks.completeAiRunFailed).toHaveBeenCalled(),
    );
    expect(mocks.completeAiRunFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun: AI_RUN,
      }),
    );
    expect(mocks.completeAiRunSucceeded).not.toHaveBeenCalled();
    expect(mocks.completeClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      status: "failed",
      userId: USER_ID,
    });
  });

  it("replacement 실패는 AI 성공을 뒤집지 않고 빈 결과 ID를 남긴다", async () => {
    mocks.replace.mockRejectedValue(new Error("replace failed"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await scheduleRelatedNoteRecommendation({
      noteId: NOTE_ID,
      ownerUserId: USER_ID,
    });
    await vi.waitFor(() =>
      expect(mocks.completeAiRunSucceeded).toHaveBeenCalled(),
    );
    expect(mocks.completeAiRunSucceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        aiRun: AI_RUN,
        featureResultIds: [],
      }),
    );
    expect(mocks.completeAiRunFailed).not.toHaveBeenCalled();
    expect(mocks.completeClaim).toHaveBeenCalledWith({
      claimId: CLAIM_ID,
      status: "failed",
      userId: USER_ID,
    });
  });
});
