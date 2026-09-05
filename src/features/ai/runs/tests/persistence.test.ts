import { after } from "next/server";
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

const afterTasks = vi.hoisted(() => [] as Promise<unknown>[]);

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => unknown) => {
    const result = callback();

    afterTasks.push(Promise.resolve(result));

    return result;
  }),
}));

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

/** 공통 Run identity입니다. */
const AI_RUN: AiRunPersistenceHandle = {
  id: AI_RUN_ID,
  userId: USER_ID,
  featureType: "note-chat",
  startedAt: STARTED_AT,
};

type InsertResult = {
  error: { message: string } | null;
};

type UpdateResult = {
  data: { id: string } | null;
  error: { message: string } | null;
};

type FinalizeResult = {
  data: string | null;
  error: { message: string } | null;
};

/**
 * 비동기 DB operation의 완료 시점을 테스트에서 직접 제어합니다.
 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return {
    promise,
    resolve,
  };
}

/**
 * after()에 등록된 persistence task가 모두 완료될 때까지 기다립니다.
 *
 * 단순 event-loop tick이 아니라 실제 등록된 background Promise를 기다립니다.
 */
async function flushPersistenceTasks(): Promise<void> {
  let processedCount = 0;

  while (processedCount < afterTasks.length) {
    const tasks = afterTasks.slice(processedCount);

    processedCount += tasks.length;

    await Promise.allSettled(tasks);
  }

  await Promise.resolve();
}

/** insert query mock을 만듭니다. */
function createInsertClient(result: InsertResult | Promise<InsertResult>) {
  const insert = vi.fn(() => Promise.resolve(result));
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
function createUpdateClient(result: UpdateResult | Promise<UpdateResult>) {
  const maybeSingle = vi.fn(() => Promise.resolve(result));
  const select = vi.fn(() => ({ maybeSingle }));
  const eq = vi.fn();
  const query = {
    eq,
    select,
  };

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
  ...results: Array<FinalizeResult | Promise<FinalizeResult>>
) {
  const rpc = vi.fn();

  for (const result of results) {
    rpc.mockImplementationOnce(() => Promise.resolve(result));
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

/** checkpoint 테스트용 persisted Run을 생성합니다. */
async function createPersistedRun(): Promise<AiRunPersistenceHandle> {
  const supabase = createInsertClient({
    error: null,
  });

  vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

  const aiRun = await createAiRun(
    {
      buildSnapshot: () => ({
        schemaVersion: 1,
      }),
      featureType: "note-chat",
      startedAt: STARTED_AT,
      userId: USER_ID,
    },
    {
      createRunId: () => AI_RUN_ID,
    },
  );

  await flushPersistenceTasks();

  return aiRun;
}

describe("AI Run persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    afterTasks.length = 0;

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
    });

    expect(buildSnapshot).toHaveBeenCalledOnce();

    await flushPersistenceTasks();

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

  it("create persistence task를 request lifecycle의 after에 등록한다", async () => {
    const supabase = createInsertClient({
      error: null,
    });

    await createAiRun(
      {
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        featureType: "note-chat",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
        supabase: supabase.client as never,
      },
    );

    expect(after).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledWith(expect.any(Function));

    await flushPersistenceTasks();
  });

  it("create DB 완료를 기다리지 않고 Run identity를 반환한다", async () => {
    const deferred = createDeferred<InsertResult>();

    const supabase = createInsertClient(deferred.promise);

    const result = await createAiRun(
      {
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        featureType: "note-chat",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
        supabase: supabase.client as never,
      },
    );

    expect(result).toEqual(AI_RUN);

    await vi.waitFor(() => {
      expect(supabase.insert).toHaveBeenCalledOnce();
    });

    deferred.resolve({
      error: null,
    });

    await flushPersistenceTasks();
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
    });

    await flushPersistenceTasks();

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
    });

    await flushPersistenceTasks();

    expect(createAdminClient).not.toHaveBeenCalled();

    expect(
      JSON.stringify(vi.mocked(reportAiOperationalError).mock.calls),
    ).not.toContain(buildError.message);
  });

  it("초기 Snapshot build가 실패한 Run도 terminal에서 동일한 Run ID로 finalize를 시도한다", async () => {
    const aiRun = await createAiRun(
      {
        buildSnapshot: () => {
          throw new Error("Snapshot build failed");
        },
        featureType: "quiz-generation",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
      },
    );

    await flushPersistenceTasks();

    const supabase = createFinalizeClient({
      data: "inserted",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await completeAiRunSucceeded({
      aiRun,
      buildSnapshot: () => ({
        finalOutput: {
          questions: [],
        },
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
      featureResultIds: [RESULT_ID],
    });

    await flushPersistenceTasks();

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

  it("create persistence가 확립되지 않은 Run은 checkpoint DB persistence를 생략한다", async () => {
    const supabase = createInsertClient({
      error: {
        message: "create failed",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    const aiRun = await createAiRun(
      {
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        featureType: "note-chat",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
      },
    );

    await flushPersistenceTasks();

    vi.mocked(createAdminClient).mockClear();

    const buildSnapshot = vi.fn(() => ({
      schemaVersion: 1,
      step: "retrieval",
    }));

    await checkpointAiRun({
      aiRun,
      buildSnapshot,
    });

    await flushPersistenceTasks();

    expect(buildSnapshot).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("create가 pending일 때 enqueue한 checkpoint도 create가 최종 실패하면 DB persistence를 생략한다", async () => {
    const createDeferredResult = createDeferred<InsertResult>();

    const createSupabase = createInsertClient(createDeferredResult.promise);

    const checkpointSupabase = createUpdateClient({
      data: {
        id: AI_RUN_ID,
      },
      error: null,
    });

    const aiRun = await createAiRun(
      {
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        featureType: "note-chat",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
        supabase: createSupabase.client as never,
      },
    );

    const buildSnapshot = vi.fn(() => ({
      schemaVersion: 1,
      step: "retrieval",
    }));

    await checkpointAiRun(
      {
        aiRun,
        buildSnapshot,
      },
      {
        supabase: checkpointSupabase.client as never,
      },
    );

    /*
     * create 결과는 아직 pending이지만 checkpoint Snapshot은
     * 현재 호출 시점에 확정되어야 한다.
     */
    expect(buildSnapshot).toHaveBeenCalledOnce();

    expect(checkpointSupabase.update).not.toHaveBeenCalled();

    createDeferredResult.resolve({
      error: {
        message: "create failed",
      },
    });

    await flushPersistenceTasks();

    /*
     * queue에서 create 실패가 확정된 뒤 checkpoint task가 실행되므로
     * 실제 checkpoint DB write는 하지 않는다.
     */
    expect(checkpointSupabase.update).not.toHaveBeenCalled();
  });

  it("checkpoint는 id, user_id, running guard로 Snapshot 전체를 교체한다", async () => {
    const aiRun = await createPersistedRun();

    const supabase = createUpdateClient({
      data: {
        id: AI_RUN_ID,
      },
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await checkpointAiRun({
      aiRun,
      buildSnapshot: () => ({
        schemaVersion: 1,
        step: "retrieval",
      }),
    });

    await flushPersistenceTasks();

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

  it("create가 pending이어도 checkpoint Snapshot은 호출 시점의 값으로 저장한다", async () => {
    const createDeferredResult = createDeferred<InsertResult>();

    const createClient = createInsertClient(createDeferredResult.promise);

    const checkpointClient = createUpdateClient({
      data: {
        id: AI_RUN_ID,
      },
      error: null,
    });

    const aiRun = await createAiRun(
      {
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        featureType: "note-chat",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
        supabase: createClient.client as never,
      },
    );

    let step = "retrieval";

    await checkpointAiRun(
      {
        aiRun,
        buildSnapshot: () => ({
          schemaVersion: 1,
          step,
        }),
      },
      {
        supabase: checkpointClient.client as never,
      },
    );

    /*
     * accumulator가 이후 변경되어도 이미 enqueue한 checkpoint는
     * retrieval 시점 Snapshot을 유지해야 한다.
     */
    step = "answer-generation";

    createDeferredResult.resolve({
      error: null,
    });

    await flushPersistenceTasks();

    expect(checkpointClient.update).toHaveBeenCalledWith({
      snapshots: {
        schemaVersion: 1,
        step: "retrieval",
      },
    });
  });

  it("checkpoint DB 완료를 기다리지 않고 호출을 종료한다", async () => {
    const aiRun = await createPersistedRun();

    const deferred = createDeferred<UpdateResult>();

    const supabase = createUpdateClient(deferred.promise);

    await expect(
      checkpointAiRun(
        {
          aiRun,
          buildSnapshot: () => ({
            schemaVersion: 1,
            step: "retrieval",
          }),
        },
        {
          supabase: supabase.client as never,
        },
      ),
    ).resolves.toBeUndefined();

    await vi.waitFor(() => {
      expect(supabase.update).toHaveBeenCalledOnce();
    });

    /*
     * DB Promise가 아직 resolve되지 않았는데도 위 checkpoint 호출은
     * 이미 완료되었다.
     */
    deferred.resolve({
      data: {
        id: AI_RUN_ID,
      },
      error: null,
    });

    await flushPersistenceTasks();
  });

  it("같은 Run의 create, checkpoint, checkpoint, terminal DB write는 호출 순서대로 실행한다", async () => {
    const createDeferredResult = createDeferred<InsertResult>();
    const checkpointOneDeferred = createDeferred<UpdateResult>();
    const checkpointTwoDeferred = createDeferred<UpdateResult>();
    const terminalDeferred = createDeferred<FinalizeResult>();

    const createSupabase = createInsertClient(createDeferredResult.promise);

    const checkpointOneSupabase = createUpdateClient(
      checkpointOneDeferred.promise,
    );

    const checkpointTwoSupabase = createUpdateClient(
      checkpointTwoDeferred.promise,
    );

    const terminalSupabase = createFinalizeClient(terminalDeferred.promise);

    const aiRun = await createAiRun(
      {
        buildSnapshot: () => ({
          schemaVersion: 1,
        }),
        featureType: "note-chat",
        startedAt: STARTED_AT,
        userId: USER_ID,
      },
      {
        createRunId: () => AI_RUN_ID,
        supabase: createSupabase.client as never,
      },
    );

    await checkpointAiRun(
      {
        aiRun,
        buildSnapshot: () => ({
          schemaVersion: 1,
          step: "retrieval",
        }),
      },
      {
        supabase: checkpointOneSupabase.client as never,
      },
    );

    await checkpointAiRun(
      {
        aiRun,
        buildSnapshot: () => ({
          schemaVersion: 1,
          step: "answer-generation",
        }),
      },
      {
        supabase: checkpointTwoSupabase.client as never,
      },
    );

    await completeAiRunSucceeded(
      {
        aiRun,
        buildSnapshot: () => ({
          schemaVersion: 1,
          step: "completed",
        }),
        completedAt: COMPLETED_AT,
        featureResultIds: [RESULT_ID],
      },
      {
        supabase: terminalSupabase.client as never,
      },
    );

    await vi.waitFor(() => {
      expect(createSupabase.insert).toHaveBeenCalledOnce();
    });

    expect(checkpointOneSupabase.update).not.toHaveBeenCalled();
    expect(checkpointTwoSupabase.update).not.toHaveBeenCalled();
    expect(terminalSupabase.rpc).not.toHaveBeenCalled();

    createDeferredResult.resolve({
      error: null,
    });

    await vi.waitFor(() => {
      expect(checkpointOneSupabase.update).toHaveBeenCalledOnce();
    });

    expect(checkpointTwoSupabase.update).not.toHaveBeenCalled();
    expect(terminalSupabase.rpc).not.toHaveBeenCalled();

    checkpointOneDeferred.resolve({
      data: {
        id: AI_RUN_ID,
      },
      error: null,
    });

    await vi.waitFor(() => {
      expect(checkpointTwoSupabase.update).toHaveBeenCalledOnce();
    });

    expect(terminalSupabase.rpc).not.toHaveBeenCalled();

    checkpointTwoDeferred.resolve({
      data: {
        id: AI_RUN_ID,
      },
      error: null,
    });

    await vi.waitFor(() => {
      expect(terminalSupabase.rpc).toHaveBeenCalledOnce();
    });

    terminalDeferred.resolve({
      data: "updated",
      error: null,
    });

    await flushPersistenceTasks();
  });

  it("checkpoint persistence 실패가 뒤 terminal persistence를 막지 않는다", async () => {
    const aiRun = await createPersistedRun();

    const checkpointSupabase = createUpdateClient({
      data: null,
      error: {
        message: "checkpoint failed",
      },
    });

    const terminalSupabase = createFinalizeClient({
      data: "updated",
      error: null,
    });

    await checkpointAiRun(
      {
        aiRun,
        buildSnapshot: () => ({
          schemaVersion: 1,
          step: "retrieval",
        }),
      },
      {
        supabase: checkpointSupabase.client as never,
      },
    );

    await completeAiRunSucceeded(
      {
        aiRun,
        buildSnapshot: () => ({
          schemaVersion: 1,
          step: "completed",
        }),
        completedAt: COMPLETED_AT,
        featureResultIds: [RESULT_ID],
      },
      {
        supabase: terminalSupabase.client as never,
      },
    );

    await flushPersistenceTasks();

    expect(checkpointSupabase.update).toHaveBeenCalledOnce();

    expect(terminalSupabase.rpc).toHaveBeenCalledOnce();

    expect(terminalSupabase.rpc).toHaveBeenCalledWith(
      "finalize_ai_run",
      expect.objectContaining({
        p_run_id: AI_RUN_ID,
        p_terminal_status: "succeeded",
      }),
    );
  });

  it("checkpoint guard에 맞는 갱신 행이 없으면 operational failure로 보고한다", async () => {
    const aiRun = await createPersistedRun();

    const supabase = createUpdateClient({
      data: null,
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await checkpointAiRun({
      aiRun,
      buildSnapshot: () => ({
        schemaVersion: 1,
      }),
    });

    await flushPersistenceTasks();

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
    const aiRun = await createPersistedRun();

    vi.mocked(createAdminClient).mockClear();

    const buildError = new Error("Snapshot 원문 포함 가능");

    await expect(
      checkpointAiRun({
        aiRun,
        buildSnapshot: () => {
          throw buildError;
        },
      }),
    ).resolves.toBeUndefined();

    await flushPersistenceTasks();

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

    await flushPersistenceTasks();

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

  it("terminal DB 완료를 기다리지 않고 호출을 종료한다", async () => {
    const deferred = createDeferred<FinalizeResult>();

    const supabase = createFinalizeClient(deferred.promise);

    await expect(
      completeAiRunSucceeded(
        {
          aiRun: AI_RUN,
          buildSnapshot: () => ({
            schemaVersion: 1,
          }),
          completedAt: COMPLETED_AT,
          featureResultIds: [RESULT_ID],
        },
        {
          supabase: supabase.client as never,
        },
      ),
    ).resolves.toBeUndefined();

    await vi.waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledOnce();
    });

    /*
     * finalize RPC 결과가 아직 반환되지 않았는데도 terminal 호출자는
     * 이미 반환되었다.
     */
    deferred.resolve({
      data: "updated",
      error: null,
    });

    await flushPersistenceTasks();
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

    await flushPersistenceTasks();

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
    const createSupabase = createInsertClient({
      error: {
        message: "create failed",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue(
      createSupabase.client as never,
    );

    const aiRun = await createAiRun(
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
    );

    await flushPersistenceTasks();

    const supabase = createFinalizeClient({
      data: "inserted",
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue(supabase.client as never);

    await completeAiRunSucceeded({
      aiRun,
      buildSnapshot: () => ({
        finalOutput: {
          questions: [],
        },
        schemaVersion: 1,
      }),
      completedAt: COMPLETED_AT,
      featureResultIds: [RESULT_ID],
    });

    await flushPersistenceTasks();

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

      await flushPersistenceTasks();

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

    await flushPersistenceTasks();

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

    await flushPersistenceTasks();

    expect(supabase.rpc).toHaveBeenCalledTimes(2);

    expect(supabase.rpc.mock.calls[0]).toEqual(supabase.rpc.mock.calls[1]);

    expect(reportAiOperationalError).not.toHaveBeenCalled();
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

    await flushPersistenceTasks();

    expect(supabase.rpc).toHaveBeenCalledTimes(2);

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "AI_RUN_PERSISTENCE_FAILED",
      }),
    );

    expect(reportAiOperationalError).toHaveBeenCalledTimes(1);
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

    await flushPersistenceTasks();

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
    });

    await flushPersistenceTasks();
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
    });

    await flushPersistenceTasks();

    expect(reportAiOperationalError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "AI_RUN_PERSISTENCE_FAILED",
      }),
    );
  });
});
