import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteFeedbackReplyMock, saveFeedbackReplyMock } = vi.hoisted(() => ({
  deleteFeedbackReplyMock: vi.fn(),
  saveFeedbackReplyMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  deleteFeedbackReply: deleteFeedbackReplyMock,
  saveFeedbackReply: saveFeedbackReplyMock,
}));

vi.mock("server-only", () => ({}));

import { useDeleteFeedbackReply } from "../hooks/use-delete-feedback-reply";
import { useSaveFeedbackReply } from "../hooks/use-save-feedback-reply";

/**
 * React Query hook 테스트에서 retry와 logger side effect를 제거한 client를 생성합니다.
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

describe("reply mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("답변 저장이 성공한 경우에만 상세 및 목록 쿼리를 무효화한다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    saveFeedbackReplyMock.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useSaveFeedbackReply(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        feedbackId: "feedback-1",
        formData: new FormData(),
      });
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["admin-feedback-detail", "feedback-1"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["admin-feedbacks"],
    });
  });

  it("답변 저장이 실패 결과를 반환하면 쿼리를 무효화하지 않는다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    saveFeedbackReplyMock.mockResolvedValue({
      ok: false,
      message: "답변 저장에 실패했습니다.",
    });

    const { result } = renderHook(() => useSaveFeedbackReply(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        feedbackId: "feedback-1",
        formData: new FormData(),
      });
    });

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });

  it("답변 삭제가 성공한 경우에만 상세 및 목록 쿼리를 무효화한다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    deleteFeedbackReplyMock.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useDeleteFeedbackReply(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("feedback-1");
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["admin-feedback-detail", "feedback-1"],
    });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ["admin-feedbacks"],
    });
  });

  it("답변 삭제가 실패 결과를 반환하면 쿼리를 무효화하지 않는다", async () => {
    const queryClient = createTestQueryClient();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    deleteFeedbackReplyMock.mockResolvedValue({
      ok: false,
      message: "답변 삭제에 실패했습니다.",
    });

    const { result } = renderHook(() => useDeleteFeedbackReply(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync("feedback-1");
    });

    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
