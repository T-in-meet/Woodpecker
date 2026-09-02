import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestRelatedNoteRecommendationActionMock } = vi.hoisted(() => ({
  requestRelatedNoteRecommendationActionMock: vi.fn(),
}));

vi.mock("../../actions", () => ({
  requestRelatedNoteRecommendationAction:
    requestRelatedNoteRecommendationActionMock,
}));

vi.mock("../../execution/execution-claim-persistence", () => ({
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS: {
    CLAIMED: "claimed",
    DAILY_LIMIT_EXCEEDED: "daily_limit_exceeded",
    DUPLICATE: "duplicate",
    STALE: "stale",
  },
}));

import { relatedNotesQueryKeys } from "../../constants/query-keys";
import { useRequestRelatedNoteRecommendation } from "../use-request-related-note-recommendation";

/**
 * React Query mutation 테스트에서 retry side effect를 제거한 QueryClient를 생성합니다.
 */
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
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

describe("useRequestRelatedNoteRecommendation", () => {
  const noteId = "11111111-1111-4111-8111-111111111111";
  const claimId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("새 Claim이 생성되면 Claim ID를 먼저 전달한 뒤 Related Notes 쿼리를 무효화한다", async () => {
    const queryClient = createTestQueryClient();
    const callOrder: string[] = [];

    const invalidateQueriesSpy = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockImplementation(async () => {
        callOrder.push("invalidate");
      });

    const onAccepted = vi.fn(() => {
      callOrder.push("accepted");
    });

    requestRelatedNoteRecommendationActionMock.mockResolvedValue({
      success: true,
      execution: {
        claimId,
        status: "claimed",
      },
    });

    const { result } = renderHook(
      () =>
        useRequestRelatedNoteRecommendation(noteId, {
          onAccepted,
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(requestRelatedNoteRecommendationActionMock).toHaveBeenCalledWith({
      noteId,
    });

    expect(onAccepted).toHaveBeenCalledOnce();
    expect(onAccepted).toHaveBeenCalledWith(claimId);

    expect(invalidateQueriesSpy).toHaveBeenCalledOnce();
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: relatedNotesQueryKeys.byNoteId(noteId),
    });

    expect(callOrder).toEqual(["accepted", "invalidate"]);
  });

  it.each(["duplicate", "stale", "daily_limit_exceeded"] as const)(
    "%s 상태에서는 새 polling 대상을 등록하지 않고 최신 상태만 다시 조회한다",
    async (status) => {
      const queryClient = createTestQueryClient();
      const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
      const onAccepted = vi.fn();

      requestRelatedNoteRecommendationActionMock.mockResolvedValue({
        success: true,
        execution: {
          claimId: null,
          status,
        },
      });

      const { result } = renderHook(
        () =>
          useRequestRelatedNoteRecommendation(noteId, {
            onAccepted,
          }),
        {
          wrapper: createWrapper(queryClient),
        },
      );

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(onAccepted).not.toHaveBeenCalled();

      expect(invalidateQueriesSpy).toHaveBeenCalledOnce();
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: relatedNotesQueryKeys.byNoteId(noteId),
      });
    },
  );

  it("Action이 실패하면 오류를 전달하고 쿼리를 무효화하지 않는다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onAccepted = vi.fn();

    requestRelatedNoteRecommendationActionMock.mockResolvedValue({
      error: "관련 노트 추천 요청에 실패했습니다.",
    });

    const { result } = renderHook(
      () =>
        useRequestRelatedNoteRecommendation(noteId, {
          onAccepted,
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow(
        "관련 노트 추천 요청에 실패했습니다.",
      );
    });

    expect(onAccepted).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it("claimed 상태에 Claim ID가 없으면 실행 정보 오류로 처리한다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    const onAccepted = vi.fn();

    requestRelatedNoteRecommendationActionMock.mockResolvedValue({
      success: true,
      execution: {
        claimId: null,
        status: "claimed",
      },
    });

    const { result } = renderHook(
      () =>
        useRequestRelatedNoteRecommendation(noteId, {
          onAccepted,
        }),
      {
        wrapper: createWrapper(queryClient),
      },
    );

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow(
        "관련 노트 추천 실행 정보를 확인할 수 없습니다.",
      );
    });

    expect(onAccepted).not.toHaveBeenCalled();
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
