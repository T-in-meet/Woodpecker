import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  checkpointAiRun,
  completeAiRunFailed,
  completeAiRunSucceeded,
  createAiRun,
} from "../persistence";
import type { AiRunPersistenceHandle } from "../types";

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

/** 공통 테스트 실행 결과 ID입니다. */
const RESULT_ID = "00000000-0000-4000-8000-000000000003";

/** 공통 테스트 실행 시작 시각입니다. */
const STARTED_AT = "2026-09-04T00:00:00.000Z";

/** 공통 테스트 실행 종료 시각입니다. */
const COMPLETED_AT = "2026-09-04T00:00:01.000Z";

/** 정상적으로 초기 persistence가 완료된 공통 Run handle입니다. */
const AI_RUN: AiRunPersistenceHandle = {
  id: AI_RUN_ID,
  userId: USER_ID,
  featureType: "note-chat",
  startedAt: STARTED_AT,
  createPersisted: true,
};

/** insert query mock을 만듭니다. */
function createInsertClient(result: { error: { message: string } | null }) {
  const insert = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => ({ insert }));

  return {
    client: {
      from,
      rpc: vi.fn(),
    },
    from,
    insert,
  };
}

/** checkpoint update query chain mock을 만듭니다. */
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

  return {
    client: {
      from,
      rpc: vi.fn(),
    },
    eq,
    from,
    maybeSingle,
    select,
    update,
  };
}

/** terminal finalize RPC mock을 만듭니다. */
function createFinalizeClient(
  ...results: Array<{
    data: string | null;
    error: { message: string } | null;
  }>
) {
  const rpc = vi.fn();

  for (const result of results) {
    rpc.mockResolvedValueOnce(result);
  }

  const from = vi.fn();

  return {
    client: {
      from,
      rpc,
    },
    from,
    rpc,
  };
}

describe("AI Run persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(reportAiOperationalError).mockResolvedValue({
      errorId: "error-id",
      status: "created",
    } as never);
  });

  it("실행 전에 확정한 Run ID와 초기 Snapshot으로 running Run을 생성한다", async () => {
    const supabase = createInsertClient({
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    const buildSnapshot = vi.fn(() => ({
      schemaVersion: 1,
    }));

    const result = await createAiRun(
      {
        buildSnapshot,
        featureType: "note-chat",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
      },
    );

    expect(result).toEqual({
      id: AI_RUN_ID,
      userId: USER_ID,
      featureType: "note-chat",
      startedAt: STARTED_AT,
      createPersisted: true,
    });

    expect(buildSnapshot).toHaveBeenCalledOnce();

    expect(supabase.from).toHaveBeenCalledWith("ai_runs");

    expect(supabase.insert).toHaveBeenCalledWith({
      id: AI_RUN_ID,
      feature_type: "note-chat",
      snapshots: {
        schemaVersion: 1,
      },
      started_at: STARTED_AT,
      user_id: USER_ID,
    });
  });

  it("create DB 실패 후에도 동일한 Run ID를 가진 handle을 유지한다", async () => {
    const supabase = createInsertClient({
      error: {
        message: "민감한 Snapshot 원문",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    const result = await createAiRun(
      {
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        featureType: "related-notes",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
      },
    );

    expect(result).toEqual({
      id: AI_RUN_ID,
      userId: USER_ID,
      featureType: "related-notes",
      startedAt: STARTED_AT,
      createPersisted: false,
    });

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.not.objectContaining({
        error: expect.anything(),
      }),
    );

    expect(
      JSON.stringify(vi.mocked(reportAiOperationalError).mock.calls),
    ).not.toContain("민감한 Snapshot 원문");
  });

  it("초기 Snapshot build 실패 후에도 Run identity를 유지한다", async () => {
    const buildError = new Error("Snapshot 원문 포함 가능");

    const result = await createAiRun(
      {
        buildSnapshot: () => {
          throw buildError;
        },
        featureType: "quiz-generation",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
      },
    );

    expect(result).toEqual({
      id: AI_RUN_ID,
      userId: USER_ID,
      featureType: "quiz-generation",
      startedAt: STARTED_AT,
      createPersisted: false,
    });

    expect(createAdminClient).not.toHaveBeenCalled();

    expect(
      JSON.stringify(vi.mocked(reportAiOperationalError).mock.calls),
    ).not.toContain(buildError.message);
  });

  it("create persistence가 확립되지 않은 Run은 checkpoint DB persistence를 생략한다", async () => {
    const buildSnapshot = vi.fn(() => ({
      schemaVersion: 1,
      step: "retrieval",
    }));

    await checkpointAiRun({
      aiRun: {
        ...AI_RUN,
        createPersisted: false,
      },
      buildSnapshot,
    });

    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("checkpoint는 id, user_id, running guard로 Snapshot 전체를 교체한다", async () => {
    const supabase = createUpdateClient({
      data: {
        id: AI_RUN_ID,
      },
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await checkpointAiRun({
      aiRun: AI_RUN,
      buildSnapshot: () => ({
        schemaVersion: 1,
        step: "retrieval",
      }),
    });

    expect(supabase.update).toHaveBeenCalledWith({
      snapshots: {
        schemaVersion: 1,
        step: "retrieval",
      },
    });

    expect(supabase.eq.mock.calls).toEqual([
      ["id", AI_RUN_ID],
      ["user_id", USER_ID],
      ["status", "running"],
    ]);

    expect(supabase.select).toHaveBeenCalledWith("id");
  });

  it("checkpoint guard에 맞는 갱신 행이 없으면 operational failure로 보고한다", async () => {
    const supabase = createUpdateClient({
      data: null,
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await checkpointAiRun({
      aiRun: AI_RUN,
      buildSnapshot: () => ({
        schemaVersion: 1,
      }),
    });

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          aiRunId: AI_RUN_ID,
          userId: USER_ID,
        },
        errorCode: "AI_RUN_GUARD_FAILED",
      }),
    );
  });

  it("checkpoint Snapshot build 실패 시 DB를 호출하지 않고 오류를 전파하지 않는다", async () => {
    const buildError = new Error("Snapshot 원문 포함 가능");

    await expect(
      checkpointAiRun({
        aiRun: AI_RUN,
        buildSnapshot: () => {
          throw buildError;
        },
      }),
    ).resolves.toBeUndefined();

    expect(createAdminClient).not.toHaveBeenCalled();

    expect(
      JSON.stringify(vi.mocked(reportAiOperationalError).mock.calls),
    ).not.toContain(buildError.message);
  });

  it("성공 terminal은 finalize RPC에 최종 Snapshot과 결과 ID를 전달한다", async () => {
    const supabase = createFinalizeClient({
      data: "updated",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await completeAiRunSucceeded({
      aiRun: AI_RUN,
      buildSnapshot: () => ({
        finalOutput: {
          value: "완료",
        },
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
      featureResultIds: [RESULT_ID],
    });

    expect(supabase.rpc).toHaveBeenCalledOnce();

    expect(supabase.rpc).toHaveBeenCalledWith("finalize_ai_run", {
      p_completed_at: COMPLETED_AT,
      p_feature_result_ids: [RESULT_ID],
      p_feature_type: "note-chat",
      p_run_id: AI_RUN_ID,
      p_snapshots: {
        finalOutput: {
          value: "완료",
        },
        schemaVersion: 1,
      },
      p_started_at: STARTED_AT,
      p_terminal_status: "succeeded",
      p_user_id: USER_ID,
    });
  });

  it("실패 terminal은 빈 결과 ID 배열로 finalize한다", async () => {
    const supabase = createFinalizeClient({
      data: "updated",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await completeAiRunFailed({
      aiRun: AI_RUN,
      buildSnapshot: () => ({
        error: {
          message: "실패",
        },
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      "finalize_ai_run",
      expect.objectContaining({
        p_feature_result_ids: [],
        p_run_id: AI_RUN_ID,
        p_terminal_status: "failed",
      }),
    );
  });

  it("create persistence가 실패한 Run도 terminal에서 동일한 Run ID로 finalize를 시도한다", async () => {
    const supabase = createFinalizeClient({
      data: "inserted",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    const unpersistedRun: AiRunPersistenceHandle = {
      ...AI_RUN,
      featureType: "quiz-generation",
      createPersisted: false,
    };

    await completeAiRunSucceeded({
      aiRun: unpersistedRun,
      buildSnapshot: () => ({
        finalOutput: {
          questions: [],
        },
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
      featureResultIds: [RESULT_ID],
    });

    expect(supabase.rpc).toHaveBeenCalledOnce();

    expect(supabase.rpc).toHaveBeenCalledWith(
      "finalize_ai_run",
      expect.objectContaining({
        p_run_id: AI_RUN_ID,
        p_feature_type: "quiz-generation",
        p_started_at: STARTED_AT,
        p_terminal_status: "succeeded",
      }),
    );
  });

  it.each(["inserted", "updated", "already_terminal"] as const)(
    "terminal finalize 결과 %s는 정상 완료로 처리한다",
    async (outcome) => {
      const supabase = createFinalizeClient({
        data: outcome,
        error: null,
      });

      vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

      await expect(
        completeAiRunSucceeded({
          aiRun: AI_RUN,
          buildSnapshot: () => ({
            schemaVersion: 1,
          }),
          completedAt: COMPLETED_AT,
          featureResultIds: [],
        }),
      ).resolves.toBeUndefined();

      expect(supabase.rpc).toHaveBeenCalledOnce();
    },
  );

  it("terminal conflict는 재시도하지 않고 guard failure로 보고한다", async () => {
    const supabase = createFinalizeClient({
      data: "conflict",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await completeAiRunSucceeded({
      aiRun: AI_RUN,
      buildSnapshot: () => ({
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
      featureResultIds: [],
    });

    expect(supabase.rpc).toHaveBeenCalledOnce();

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          aiRunId: AI_RUN_ID,
          userId: USER_ID,
        },
        errorCode: "AI_RUN_GUARD_FAILED",
      }),
    );
  });

  it("terminal persistence 요청이 실패하면 동일한 finalize를 한 번만 추가 시도한다", async () => {
    const supabase = createFinalizeClient(
      {
        data: null,
        error: {
          message: "temporary failure",
        },
      },
      {
        data: "updated",
        error: null,
      },
    );

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await completeAiRunSucceeded({
      aiRun: AI_RUN,
      buildSnapshot: () => ({
        finalOutput: {
          value: "완료",
        },
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
      featureResultIds: [RESULT_ID],
    });

    expect(supabase.rpc).toHaveBeenCalledTimes(2);

    expect(supabase.rpc.mock.calls[0]).toEqual(supabase.rpc.mock.calls[1]);
  });

  it("terminal persistence 재시도도 실패하면 추가 시도 없이 종료한다", async () => {
    const supabase = createFinalizeClient(
      {
        data: null,
        error: {
          message: "first failure",
        },
      },
      {
        data: null,
        error: {
          message: "second failure",
        },
      },
    );

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await expect(
      completeAiRunSucceeded({
        aiRun: AI_RUN,
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        completedAt: COMPLETED_AT,
        featureResultIds: [],
      }),
    ).resolves.toBeUndefined();

    expect(supabase.rpc).toHaveBeenCalledTimes(2);

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "AI_RUN_PERSISTENCE_FAILED",
      }),
    );
  });

  it("terminal Snapshot build 실패 시 finalize를 호출하지 않고 오류를 전파하지 않는다", async () => {
    const buildError = new Error("terminal Snapshot 원문");

    await expect(
      completeAiRunSucceeded({
        aiRun: AI_RUN,
        buildSnapshot: () => {
          throw buildError;
        },
        completedAt: COMPLETED_AT,
        featureResultIds: [],
      }),
    ).resolves.toBeUndefined();

    expect(createAdminClient).not.toHaveBeenCalled();

    expect(
      JSON.stringify(vi.mocked(reportAiOperationalError).mock.calls),
    ).not.toContain(buildError.message);
  });

  it("operational reporter 실패도 create 호출자에게 전파하지 않는다", async () => {
    const supabase = createInsertClient({
      error: {
        message: "insert failed",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    vi.mocked(reportAiOperationalError).mockRejectedValue(
      new Error("report failed"),
    );

    await expect(
      createAiRun(
        {
          buildSnapshot: () => ({
            schemaVersion: 1,
          }),
          featureType: "quiz-generation",
          startedAt: STARTED_AT,
          userId: USER_ID,
        },
        {
          createRunId: () => AI_RUN_ID,
        },
      ),
    ).resolves.toEqual({
      id: AI_RUN_ID,
      userId: USER_ID,
      featureType: "quiz-generation",
      startedAt: STARTED_AT,
      createPersisted: false,
    });
  });

  it("Admin Client 생성 실패도 operational failure로 격리하고 Run identity를 유지한다", async () => {
    vi.mocked(createAdminClient).mockImplementation(() => {
      throw new Error("client config failed");
    });

    await expect(
      createAiRun(
        {
          buildSnapshot: () => ({
            schemaVersion: 1,
          }),
          featureType: "review-grading",
          startedAt: STARTED_AT,
          userId: USER_ID,
        },
        {
          createRunId: () => AI_RUN_ID,
        },
      ),
    ).resolves.toEqual({
      id: AI_RUN_ID,
      userId: USER_ID,
      featureType: "review-grading",
      startedAt: STARTED_AT,
      createPersisted: false,
    });

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "AI_RUN_PERSISTENCE_FAILED",
      }),
    );
  });
});
