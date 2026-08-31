import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { relatedNotesQueryKeys } from "../../constants/query-keys";
import { getRelatedNotes } from "../../queries";
import { useRelatedNotes } from "../use-related-notes";

vi.mock("../../queries", () => ({
  getRelatedNotes: vi.fn(),
}));

const getRelatedNotesMock = vi.mocked(getRelatedNotes);

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
 * useRelatedNotes가 사용하는 query 결과 중
 * execution polling 테스트에 필요한 최소 데이터만 생성합니다.
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

describe("useRelatedNotes", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("페이지 진입 시 running Claim이 존재하면 자동 polling을 시작한다", async () => {
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

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(true);
    });
  });

  it("새 Claim ID를 전달하면 즉시 해당 실행의 polling을 시작한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

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
  });

  it("추적 중인 Claim이 succeeded가 되면 running 상태를 관찰하지 못했더라도 polling을 종료한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

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

    act(() => {
      queryClient.setQueryData(
        relatedNotesQueryKeys.byNoteId(NOTE_ID),
        createRelatedNotesResult({
          latestRecommendationExecution: {
            id: CLAIM_ID,
            status: "succeeded",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });
  });

  it.each(["failed", "stale"] as const)(
    "추적 중인 Claim이 %s가 되면 polling을 종료한다",
    async (status) => {
      const queryClient = createTestQueryClient();

      getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

      const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      act(() => {
        result.current.startRecommendationPolling(CLAIM_ID);
      });

      act(() => {
        queryClient.setQueryData(
          relatedNotesQueryKeys.byNoteId(NOTE_ID),
          createRelatedNotesResult({
            latestRecommendationExecution: {
              id: CLAIM_ID,
              status,
            },
          }),
        );
      });

      await waitFor(() => {
        expect(result.current.isRecommendationPolling).toBe(false);
      });
    },
  );

  it("최신 execution이 다른 Claim이면 현재 Claim의 polling을 종료하지 않는다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

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
  });

  it("DB execution이 running인 동안에는 Client timeout 없이 polling을 계속한다", async () => {
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

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await Promise.resolve();
    });

    /*
     * 최초 query 결과의 running Claim을 hook이 추적 대상으로 등록하도록
     * React effect 실행을 한 번 진행합니다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    const callsBeforePolling = getRelatedNotesMock.mock.calls.length;

    /*
     * stale 여부는 Client 시간이 아니라 DB 조회 결과로만 결정합니다.
     * 따라서 시간이 오래 지나더라도 DB가 계속 running을 반환하는 동안에는
     * 5초 간격 polling이 계속 유지되어야 합니다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(180_000);
    });

    expect(result.current.isRecommendationPolling).toBe(true);
    expect(getRelatedNotesMock.mock.calls.length).toBeGreaterThan(
      callsBeforePolling,
    );
  });

  it("polling 중 DB execution이 stale로 전환되면 polling을 종료한다", async () => {
    const queryClient = createTestQueryClient();

    const runningResult = createRelatedNotesResult({
      hasRunningRecommendationExecution: true,
      latestRecommendationExecution: {
        id: CLAIM_ID,
        status: "running",
      },
    });

    const staleResult = createRelatedNotesResult({
      latestRecommendationExecution: {
        id: CLAIM_ID,
        status: "stale",
      },
    });

    getRelatedNotesMock
      .mockResolvedValueOnce(runningResult)
      .mockResolvedValueOnce(staleResult)
      .mockResolvedValue(staleResult);

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    /*
     * 최초 조회에서 running Claim을 발견하면
     * hook이 해당 Claim을 polling 대상으로 추적해야 합니다.
     */
    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(true);
    });

    expect(result.current.data?.latestRecommendationExecution).toEqual({
      id: CLAIM_ID,
      status: "running",
    });

    /*
     * 실제 polling과 동일하게 같은 query를 다시 조회합니다.
     *
     * stale 판정은 Client가 하지 않고 getRelatedNotes의 DB cleanup 결과를
     * 그대로 받아 terminal 상태로 처리합니다.
     */
    await act(async () => {
      await queryClient.refetchQueries({
        queryKey: relatedNotesQueryKeys.byNoteId(NOTE_ID),
        exact: true,
      });
    });

    await waitFor(() => {
      expect(result.current.data?.latestRecommendationExecution).toEqual({
        id: CLAIM_ID,
        status: "stale",
      });
    });

    await waitFor(() => {
      expect(result.current.isRecommendationPolling).toBe(false);
    });

    expect(getRelatedNotesMock).toHaveBeenCalledTimes(2);
  });

  it("Note ID가 변경되면 이전 Note의 polling 상태를 초기화한다", async () => {
    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

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
