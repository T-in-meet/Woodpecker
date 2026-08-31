import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { relatedNotesQueryKeys } from "../../constants/query-keys";
import {
  getRelatedNoteRecommendationExecutionClaim,
  getRelatedNotes,
} from "../../queries";
import { useRelatedNotes } from "../use-related-notes";

vi.mock("../../queries", () => ({
  getRelatedNoteRecommendationExecutionClaim: vi.fn(),
  getRelatedNotes: vi.fn(),
}));

const getRelatedNotesMock = vi.mocked(getRelatedNotes);
const getRelatedNoteRecommendationExecutionClaimMock = vi.mocked(
  getRelatedNoteRecommendationExecutionClaim,
);

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

  it("tracked Claim 조회에 실패하면 실행 완료로 오인하지 않고 polling 상태를 유지한다", async () => {
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

    await waitFor(() => {
      expect(
        getRelatedNoteRecommendationExecutionClaimMock,
      ).toHaveBeenCalledWith(NOTE_ID, CLAIM_ID);
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryState(
          relatedNotesQueryKeys.executionClaim(NOTE_ID, CLAIM_ID),
        )?.status,
      ).toBe("error");
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
     * Client에는 별도 timeout이 없습니다.
     * DB가 계속 running을 반환하는 동안에는 Claim ID 전용 polling이 유지됩니다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    expect(
      getRelatedNoteRecommendationExecutionClaimMock.mock.calls.length,
    ).toBeGreaterThan(callsBeforePolling);
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
});
