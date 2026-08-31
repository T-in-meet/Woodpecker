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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    expect(result.current.isPollingTimedOut).toBe(false);
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
    expect(result.current.isPollingTimedOut).toBe(false);
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

    expect(result.current.isPollingTimedOut).toBe(false);
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

      expect(result.current.isPollingTimedOut).toBe(false);
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

  it("110초 timeout 이후 DB execution이 계속 running이면 timeout 상태를 노출한다", async () => {
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
     * 최초 query 결과에서 running Claim을 발견하는 effect가 실행될 시간을 줍니다.
     */
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isRecommendationPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(110_000);
    });

    expect(result.current.isRecommendationPolling).toBe(false);
    expect(result.current.isPollingTimedOut).toBe(true);
  });

  it("timeout 이후 DB execution이 running이 아니면 timeout UI 상태를 노출하지 않는다", async () => {
    vi.useFakeTimers();

    const queryClient = createTestQueryClient();

    getRelatedNotesMock.mockResolvedValue(createRelatedNotesResult());

    const { result } = renderHook(() => useRelatedNotes(NOTE_ID), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.startRecommendationPolling(CLAIM_ID);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(110_000);
    });

    expect(result.current.isRecommendationPolling).toBe(false);
    expect(result.current.isPollingTimedOut).toBe(false);
  });

  it("Note ID가 변경되면 이전 Note의 polling과 timeout 상태를 초기화한다", async () => {
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

    expect(result.current.isPollingTimedOut).toBe(false);
  });
});
