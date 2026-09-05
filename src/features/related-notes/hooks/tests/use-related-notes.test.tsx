import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { relatedNotesQueryKeys } from "../../constants/query-keys";
import {
  getRelatedNoteRecommendationExecutionClaim,
  getRelatedNotes,
} from "../../queries";
import { useRelatedNotes } from "../use-related-notes";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("../../queries", () => ({
  getRelatedNoteRecommendationExecutionClaim: vi.fn(),
  getRelatedNotes: vi.fn(),
}));

const getRelatedNotesMock = vi.mocked(getRelatedNotes);
const getRelatedNoteRecommendationExecutionClaimMock = vi.mocked(
  getRelatedNoteRecommendationExecutionClaim,
);
const toastErrorMock = vi.mocked(toast.error);

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_NOTE_ID = "22222222-2222-4222-8222-222222222222";
const CLAIM_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_CLAIM_ID = "44444444-4444-4444-8444-444444444444";

/**
 * React Query hook 테스트에서 retry와 불필요한 cache 재사용을 제거한
 * QueryClient를 생성합니다.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 0,
        retry: false,
      },
    },
  });
}

/**
 * hook에 QueryClientProvider를 제공하는 테스트 wrapper를 생성합니다.
 */
function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

/**
 * useRelatedNotes가 사용하는 main query 결과 중
 * execution polling 테스트에 필요한 최소 데이터를 생성합니다.
 */
function createRelatedNotesResult({
  hasRunningRecommendationExecution = false,
  hasFailedRecommendationExecution = false,
  latestRecommendationExecution = null,
  recommendationUsage = {
    used: 0,
    limit: 10,
  },
}: {
  hasRunningRecommendationExecution?: boolean;
  hasFailedRecommendationExecution?: boolean;
  latestRecommendationExecution?: {
    id: string;
    status: "running" | "succeeded" | "failed" | "stale";
  } | null;
  recommendationUsage?: {
    used: number;
    limit: number;
  };
} = {}) {
  return {
    hasRunningRecommendationExecution,
    hasFailedRecommendationExecution,
    latestRecommendationExecution,
    recommendationUsage,
    relatedNotes: [],
  } satisfies Awaited<ReturnType<typeof getRelatedNotes>>;
}

/**
 * 특정 execution Claim 조회 결과를 생성합니다.
 */
function createExecutionClaim(
  status: "running" | "succeeded" | "failed" | "stale",
  id = CLAIM_ID,
) {
  return {
    id,
    status,
  } satisfies NonNullable<
    Awaited<ReturnType<typeof getRelatedNoteRecommendationExecutionClaim>>
  >;
}

describe("useRelatedNotes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("페이지 진입 시 현재 Note version의 running Claim이 존재하면 해당 Claim polling을 시작한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(
      createRelatedNotesResult({
        hasRunningRecommendationExecution: true,
        latestRecommendationExecution: {
          id: CLAIM_ID,
          status: "running",
        },
      }),
    );

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("running"),
    );

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(true);
    });

    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });
  });

  it("새 Claim ID를 전달하면 즉시 해당 Claim의 polling을 시작한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());
    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("running"),
    );

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });
  });

  it("추적 중인 Claim이 succeeded이면 running 상태를 관찰하지 못했더라도 polling을 종료하고 main query를 다시 조회한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("succeeded"),
    );

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const callsBeforeTracking = getRelatedNotesMock.mock.calls.length;

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });

    expect(getRelatedNoteRecommendationExecutionClaimMock).toHaveBeenCalledWith(
      NOTE_ID,
      CLAIM_ID,
    );

    await waitFor(() => {
      expect(getRelatedNotesMock.mock.calls.length).toBeGreaterThan(
        callsBeforeTracking,
      );
    });
  });

  it.each(["failed", "stale"] as const)(
    "추적 중인 Claim이 %s가 되면 polling을 종료하고 main query를 다시 조회한다",
    async (status) => {
      const queryClient = createTestQueryClient();

      getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

      getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
        createExecutionClaim(status),
      );

      const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const callsBeforeTracking = getRelatedNotesMock.mock.calls.length;

      act(() => {
        result.current.startRecommendationPolling(CLAIM_ID);
      });

      await waitFor(() => {
        expect(result.current.isRecommendationPolling).toBe(false);
      });

      await waitFor(() => {
        expect(getRelatedNotesMock.mock.calls.length).toBeGreaterThan(
          callsBeforeTracking,
        );
      });
    },
  );

  it("현재 Note version의 latest execution이 추적 중인 Claim과 달라져도 tracked Claim을 계속 추적한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("running"),
    );

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });

    /*
     * 추천 실행 도중 Note가 수정되어 current source version이 바뀐 상황을
     * latest execution이 다른 Claim으로 변경된 것으로 재현합니다.
     *
     * tracked Claim lifecycle은 main query의 current-version 상태와
     * 독립적이어야 하므로 기존 Claim polling은 유지되어야 합니다.
     */
    act(() => {
      queryClient.setQueryData(
        relatedNotesQueryKeys.byNoteId(NOTE_ID),
        createRelatedNotesResult({
          latestRecommendationExecution: {
            id: OTHER_CLAIM_ID,
            status: "succeeded",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(true);
    });

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenLastCalledWith(NOTE_ID, CLAIM_ID);
  });

  it("현재 Note version에서 기존 Claim이 사라져도 tracked Claim이 terminal이 되면 polling을 종료한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("running"),
    );

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(true);
    });

    /*
     * Note 수정으로 source_updated_at이 변경되어
     * main query의 current-version latest Claim에서 기존 Claim이 사라진 상황입니다.
     */
    act(() => {
      queryClient.setQueryData(
        relatedNotesQueryKeys.byNoteId(NOTE_ID),
        createRelatedNotesResult({
          latestRecommendationExecution: null,
        }),
      );
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    /*
     * tracked Claim 자체는 Claim ID 전용 query에서 계속 조회하며,
     * terminal 상태가 확인되면 current source version과 관계없이 종료해야 합니다.
     */
    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("succeeded"),
    );

    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        exact: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });
  });

  it("tracked Claim 조회가 정상 완료됐지만 Claim이 존재하지 않으면 polling을 종료한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(null);

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });
  });

  it("tracked Claim 조회가 일시적으로 실패하면 허용 횟수 전까지 polling 상태를 유지한다", async () => {
    const queryClient = createTestQueryClient();
    const dbError = new Error("execution claim query failed");

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());
    getRelatedNoteRecommendationExecutionClaimMock.mockRejectedValue(dbError);

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    /*
     * 최초 Claim 조회 실패를 기다립니다.
     */
    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledTimes(1);
    });

    expect(result.current.isRecommendationPolling).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();

    /*
     * 두 번째 연속 조회 실패까지는 일시적인 오류로 보고
     * Claim 추적과 UI 잠금을 유지합니다.
     */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        exact: true,
      });
    });

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenCalledTimes(2);

    expect(result.current.isRecommendationPolling).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("tracked Claim 조회가 3회 연속 실패하면 polling을 종료하고 동일 Claim을 자동 재추적하지 않는다", async () => {
    const queryClient = createTestQueryClient();
    const dbError = new Error("execution claim query failed");

    /*
     * main query에는 계속 동일한 running Claim이 존재하는 상황입니다.
     *
     * polling을 포기한 뒤 이 값 때문에 같은 Claim이 다시 자동 추적되면
     * UI가 즉시 재잠금되므로 이를 회귀 테스트합니다.
     */
    getRelatedNotesMock.mockResolvedValue(
      createRelatedNotesResult({
        hasRunningRecommendationExecution: true,
        latestRecommendationExecution: {
          id: CLAIM_ID,
          status: "running",
        },
      }),
    );

    getRelatedNoteRecommendationExecutionClaimMock.mockRejectedValue(dbError);

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    /*
     * main query에서 running Claim을 발견하고
     * 최초 Claim 조회가 실패할 때까지 기다립니다.
     */
    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledTimes(1);
    });

    expect(result.current.isRecommendationPolling).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();

    /*
     * 두 번째 조회 실패를 발생시킵니다.
     */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        exact: true,
      });
    });

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenCalledTimes(2);

    expect(result.current.isRecommendationPolling).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();

    /*
     * 세 번째 연속 조회 실패를 발생시킵니다.
     */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        exact: true,
      });
    });

    /*
     * 세 번째 연속 실패 후 Client 추적과 UI 잠금이 해제되어야 합니다.
     */
    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenCalledTimes(3);

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
    expect(toastErrorMock).toHaveBeenCalledWith(
      "AI 추천 실행 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
    );

    /*
     * main query에는 동일 Claim이 여전히 running으로 남아 있습니다.
     *
     * main query 데이터를 다시 갱신해 자동 추적 effect를 재평가시켜도
     * abandoned Claim은 다시 tracked Claim이 되어서는 안 됩니다.
     */
    act(() => {
      queryClient.setQueryData(
        relatedNotesQueryKeys.byNoteId(NOTE_ID),
        createRelatedNotesResult({
          hasRunningRecommendationExecution: true,
          latestRecommendationExecution: {
            id: CLAIM_ID,
            status: "running",
          },
        }),
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isRecommendationPolling).toBe(false);

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenCalledTimes(3);

    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it("polling 포기 후 새 Claim을 직접 시작하면 이전 포기 상태를 초기화하고 새 Claim을 추적한다", async () => {
    const queryClient = createTestQueryClient();
    const dbError = new Error("execution claim query failed");

    getRelatedNotesMock.mockResolvedValue(
      createRelatedNotesResult({
        hasRunningRecommendationExecution: true,
        latestRecommendationExecution: {
          id: CLAIM_ID,
          status: "running",
        },
      }),
    );

    getRelatedNoteRecommendationExecutionClaimMock.mockRejectedValue(dbError);

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    /*
     * 기존 Claim의 최초 조회 실패를 기다립니다.
     */
    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledTimes(1);
    });

    /*
     * 두 번째 실패를 발생시킵니다.
     */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        exact: true,
      });
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    /*
     * 세 번째 실패를 발생시켜 기존 Claim 추적을 포기합니다.
     */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        exact: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenCalledTimes(3);

    expect(toastErrorMock).toHaveBeenCalledTimes(1);

    /*
     * 이후 사용자가 새 AI 추천을 실행하여
     * 새로운 Claim ID를 직접 전달한 상황입니다.
     */
    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("running", OTHER_CLAIM_ID),
    );

    act(() => {
      result.current.startRecommendationPolling(OTHER_CLAIM_ID);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    /*
     * 새 Claim 전용 query가 실제로 시작되는지 확인합니다.
     */
    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, OTHER_CLAIM_ID);
    });

    expect(result.current.isRecommendationPolling).toBe(true);
  });

  it("DB execution이 running인 동안에는 Client timeout 없이 tracked Claim polling을 계속한다", async () => {
    vi.useFakeTimers();

    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(
      createRelatedNotesResult({
        hasRunningRecommendationExecution: true,
        latestRecommendationExecution: {
          id: CLAIM_ID,
          status: "running",
        },
      }),
    );

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("running"),
    );

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await Promise.resolve();
    });

    /*
     * 최초 main query에서 running Claim을 발견하고
     * tracked Claim query를 시작하도록 effect를 진행합니다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    const callsBeforePolling =
      getRelatedNoteRecommendationExecutionClaimMock.mock.calls.length;

    /*
     * Client에는 실행 자체에 대한 별도 timeout이 없습니다.
     *
     * Claim 조회가 정상적으로 성공하면서 DB가 계속 running을 반환하는 동안에는
     * Claim ID 전용 polling이 유지됩니다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    expect(
      getRelatedNoteRecommendationExecutionClaimMock.mock.calls.length,
    ).toBeGreaterThan(callsBeforePolling);

    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("polling 중 tracked Claim이 stale로 전환되면 polling을 종료한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(
      createRelatedNotesResult({
        hasRunningRecommendationExecution: true,
        latestRecommendationExecution: {
          id: CLAIM_ID,
          status: "running",
        },
      }),
    );

    getRelatedNoteRecommendationExecutionClaimMock
      .mockResolvedValueOnce(createExecutionClaim("running"))
      .mockResolvedValue(createExecutionClaim("stale"));

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(true);
    });

    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });

    /*
     * stale 판정 자체는 tracked Claim Server query의 DB cleanup에서 이루어집니다.
     * Client는 다음 Claim polling 결과의 terminal 상태만 소비합니다.
     */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        exact: true,
      });
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });
  });

  it("Note ID가 변경되면 이전 Note의 polling 상태를 초기화한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("running"),
    );

    const { result, rerender } = renderHook(
      ({ noteId }) => useRelatedNotes(noteId),
      {
        initialProps: {
          noteId: NOTE_ID,
        },
        wrapper: createWrapper(queryClient),
      },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    rerender({
      noteId: OTHER_NOTE_ID,
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });
  });

  it("terminal Claim 확인 후 main query 갱신 전 동일 Claim을 다시 자동 추적하지 않는다", async () => {
    const queryClient = createTestQueryClient();

    let resolveMainQueryRefetch:
      | ((value: Awaited<ReturnType<typeof getRelatedNotes>>) => void)
      | null = null;

    /*
     * 최초 main query에는 현재 Note version의 동일 Claim이
     * 아직 running 상태로 남아 있습니다.
     */
    getRelatedNotesMock
      .mockResolvedValueOnce(
        createRelatedNotesResult({
          hasRunningRecommendationExecution: true,
          latestRecommendationExecution: {
            id: CLAIM_ID,
            status: "running",
          },
        }),
      )
      /*
       * terminal Claim 확인 후 실행되는 main query refetch는
       * pending 상태로 유지합니다.
       *
       * 따라서 이 동안 main query cache에는
       * 최초의 running 상태가 그대로 남아 있습니다.
       */
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveMainQueryRefetch = resolve;
          }),
      );

    /*
     * Claim ID 전용 query에서는 같은 Claim이 이미
     * succeeded terminal 상태가 된 것을 반환합니다.
     */
    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(
      createExecutionClaim("succeeded"),
    );

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    /*
     * 최초 main query의 running Claim을 발견하면
     * 해당 Claim을 자동 추적합니다.
     */
    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });

    /*
     * tracked Claim의 terminal 상태를 확인한 뒤
     * main query를 한 번 다시 조회합니다.
     */
    await waitFor(() => {
      expect(getRelatedNotesMock).toHaveBeenCalledTimes(2);
    });

    /*
     * main query refetch는 아직 완료되지 않았으므로
     * cache에는 동일 Claim의 running 상태가 남아 있습니다.
     */
    expect(
      queryClient.getQueryData(relatedNotesQueryKeys.byNoteId(NOTE_ID)),
    ).toMatchObject({
      latestRecommendationExecution: {
        id: CLAIM_ID,
        status: "running",
      },
    });

    /*
     * 그래도 terminal 상태를 직접 확인한 동일 Claim을
     * 다시 자동 추적하면 안 됩니다.
     */
    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenCalledTimes(1);

    expect(getRelatedNotesMock).toHaveBeenCalledTimes(2);

    /*
     * 테스트 종료 전에 pending main query refetch를 완료합니다.
     */
    await act(async () => {
      resolveMainQueryRefetch?.(
        createRelatedNotesResult({
          latestRecommendationExecution: {
            id: CLAIM_ID,
            status: "succeeded",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.data?.latestRecommendationExecution).toEqual({
        id: CLAIM_ID,
        status: "succeeded",
      });
    });

    expect(result.current.isRecommendationPolling).toBe(false);
  });

  it("tracked Claim이 존재하지 않고 main query에 동일 Claim의 running 상태가 남아 있어도 다시 자동 추적하지 않는다", async () => {
    const queryClient = createTestQueryClient();

    let resolveMainQueryRefetch:
      | ((value: Awaited<ReturnType<typeof getRelatedNotes>>) => void)
      | null = null;

    getRelatedNotesMock
      .mockResolvedValueOnce(
        createRelatedNotesResult({
          hasRunningRecommendationExecution: true,
          latestRecommendationExecution: {
            id: CLAIM_ID,
            status: "running",
          },
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveMainQueryRefetch = resolve;
          }),
      );

    getRelatedNoteRecommendationExecutionClaimMock.mockResolvedValue(null);

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });

    await waitFor(() => {
      expect(getRelatedNotesMock).toHaveBeenCalledTimes(2);
    });

    expect(
      queryClient.getQueryData(relatedNotesQueryKeys.byNoteId(NOTE_ID)),
    ).toMatchObject({
      latestRecommendationExecution: {
        id: CLAIM_ID,
        status: "running",
      },
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });

    expect(
      getRelatedNoteRecommendationExecutionClaimMock,
    ).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveMainQueryRefetch?.(
        createRelatedNotesResult({
          latestRecommendationExecution: null,
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.data?.latestRecommendationExecution).toBeNull();
    });

    expect(result.current.isRecommendationPolling).toBe(false);
  });
});
