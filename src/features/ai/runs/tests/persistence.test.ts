import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  checkpointAiRun,
  completeAiRunFailed,
  completeAiRunSucceeded,
  createAiRun,
} from "../persistence";

vi.mock("@/features/ai/utils/report-ai-operational-error", () => ({
  reportAiOperationalError: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

/** 공통 테스트 사용자 ID입니다. */
const USER_ID = "00000000-0000-4000-8000-000000000001";

/** 공통 테스트 AI Run ID입니다. */
const AI_RUN_ID = "00000000-0000-4000-8000-000000000002";

/** 공통 테스트 실행 시작 시각입니다. */
const STARTED_AT = "2026-09-04T00:00:00.000Z";

/** 공통 테스트 실행 종료 시각입니다. */
const COMPLETED_AT = "2026-09-04T00:00:01.000Z";

/** insert query chain mock을 만듭니다. */
function createInsertClient(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));

  return { client: { from }, from, insert, maybeSingle, select };
}

/** update query chain mock을 만듭니다. */
function createUpdateClient(result: {
  data: { id: string } | null;
  error: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn();
  const query = { eq, select };
  eq.mockReturnValue(query);
  const update = vi.fn(() => query);
  const from = vi.fn(() => ({ update }));

  return { client: { from }, eq, from, maybeSingle, select, update };
}

describe("AI Run persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reportAiOperationalError).mockResolvedValue({
      errorId: "error-id",
      status: "created",
    } as never);
  });

  it("검증된 초기 Snapshot과 migration 필수 값으로 Run을 생성한다", async () => {
    const supabase = createInsertClient({
      data: { id: AI_RUN_ID },
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);
    const buildSnapshot = vi.fn(() => ({ schemaVersion: 1 }));

    const result = await createAiRun({
      buildSnapshot,
      featureType: "note-chat",
      startedAt: STARTED_AT,
      userId: USER_ID,
    });

    expect(result).toBe(AI_RUN_ID);
    expect(buildSnapshot).toHaveBeenCalledOnce();
    expect(supabase.from).toHaveBeenCalledWith("ai_runs");
    expect(supabase.insert).toHaveBeenCalledWith({
      feature_type: "note-chat",
      snapshots: { schemaVersion: 1 },
      started_at: STARTED_AT,
      user_id: USER_ID,
    });
  });

  it("create DB 실패를 보고하고 null을 반환한다", async () => {
    const supabase = createInsertClient({
      data: null,
      error: { message: "민감한 Snapshot 원문" },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await expect(
      createAiRun({
        buildSnapshot: () => ({ schemaVersion: 1 }),
        featureType: "related-notes",
        startedAt: STARTED_AT,
        userId: USER_ID,
      }),
    ).resolves.toBeNull();

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.not.objectContaining({ error: expect.anything() }),
    );
    expect(
      JSON.stringify(vi.mocked(reportAiOperationalError).mock.calls),
    ).not.toContain("민감한 Snapshot 원문");
  });

  it("null Run의 checkpoint와 terminal은 build와 DB client 생성을 생략한다", async () => {
    const buildSnapshot = vi.fn(() => ({ schemaVersion: 1 }));
    const common = { aiRunId: null, buildSnapshot, userId: USER_ID };

    await checkpointAiRun(common);
    await completeAiRunFailed({ ...common, completedAt: COMPLETED_AT });
    await completeAiRunSucceeded({
      ...common,
      completedAt: COMPLETED_AT,
      featureResultIds: [],
    });

    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("checkpoint는 id, user_id, running guard로 Snapshot 전체를 교체한다", async () => {
    const supabase = createUpdateClient({
      data: { id: AI_RUN_ID },
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await checkpointAiRun({
      aiRunId: AI_RUN_ID,
      buildSnapshot: () => ({ schemaVersion: 1, step: "retrieval" }),
      userId: USER_ID,
    });

    expect(supabase.update).toHaveBeenCalledWith({
      snapshots: { schemaVersion: 1, step: "retrieval" },
    });
    expect(supabase.eq.mock.calls).toEqual([
      ["id", AI_RUN_ID],
      ["user_id", USER_ID],
      ["status", "running"],
    ]);
    expect(supabase.select).toHaveBeenCalledWith("id");
  });

  it("guard에 맞는 갱신 행이 없으면 operational failure로 보고한다", async () => {
    const supabase = createUpdateClient({ data: null, error: null });
    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await checkpointAiRun({
      aiRunId: AI_RUN_ID,
      buildSnapshot: () => ({ schemaVersion: 1 }),
      userId: USER_ID,
    });

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { aiRunId: AI_RUN_ID, userId: USER_ID },
        errorCode: "AI_RUN_GUARD_FAILED",
      }),
    );
  });

  it("Snapshot build 실패 시 DB를 호출하지 않고 오류를 전파하지 않는다", async () => {
    const buildError = new Error("Snapshot 원문 포함 가능");

    await expect(
      checkpointAiRun({
        aiRunId: AI_RUN_ID,
        buildSnapshot: () => {
          throw buildError;
        },
        userId: USER_ID,
      }),
    ).resolves.toBeUndefined();

    expect(createAdminClient).not.toHaveBeenCalled();
    expect(
      JSON.stringify(vi.mocked(reportAiOperationalError).mock.calls),
    ).not.toContain(buildError.message);
  });

  it("성공 terminal은 상태, 시각, Snapshot과 결과 ID를 한 UPDATE로 저장한다", async () => {
    const supabase = createUpdateClient({
      data: { id: AI_RUN_ID },
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);
    const resultId = "00000000-0000-4000-8000-000000000003";

    await completeAiRunSucceeded({
      aiRunId: AI_RUN_ID,
      buildSnapshot: () => ({
        finalOutput: { value: "완료" },
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
      featureResultIds: [resultId],
      userId: USER_ID,
    });

    expect(supabase.update).toHaveBeenCalledOnce();
    expect(supabase.update).toHaveBeenCalledWith({
      completed_at: COMPLETED_AT,
      feature_result_ids: [resultId],
      snapshots: { finalOutput: { value: "완료" }, schemaVersion: 1 },
      status: "succeeded",
    });
  });

  it("실패 terminal은 호출자가 결과 ID를 전달할 수 없고 빈 배열을 저장한다", async () => {
    const supabase = createUpdateClient({
      data: { id: AI_RUN_ID },
      error: null,
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await completeAiRunFailed({
      aiRunId: AI_RUN_ID,
      buildSnapshot: () => ({ error: { message: "실패" }, schemaVersion: 1 }),
      completedAt: COMPLETED_AT,
      userId: USER_ID,
    });

    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        feature_result_ids: [],
        status: "failed",
      }),
    );
  });

  it("operational reporter 실패도 호출자에게 전파하지 않는다", async () => {
    const supabase = createInsertClient({
      data: null,
      error: { message: "insert failed" },
    });
    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);
    vi.mocked(reportAiOperationalError).mockRejectedValue(
      new Error("report failed"),
    );

    await expect(
      createAiRun({
        buildSnapshot: () => ({ schemaVersion: 1 }),
        featureType: "quiz-generation",
        startedAt: STARTED_AT,
        userId: USER_ID,
      }),
    ).resolves.toBeNull();
  });

  it("Admin Client 생성 실패도 operational failure로 격리한다", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("client config failed");
    });

    await expect(
      createAiRun({
        buildSnapshot: () => ({ schemaVersion: 1 }),
        featureType: "review-grading",
        startedAt: STARTED_AT,
        userId: USER_ID,
      }),
    ).resolves.toBeNull();

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "AI_RUN_PERSISTENCE_FAILED",
      }),
    );
  });
});
