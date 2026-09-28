import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { relatedNotesQueryKeys } from "../../constants/query-keys";
import { getRelatedNoteCandidates } from "../../queries";
import { useRelatedNoteCandidates } from "../use-related-note-candidates";

vi.mock("../../queries", () => ({
  getRelatedNoteCandidates: vi.fn(),
}));

describe("후보 조회 활성화", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRelatedNoteCandidates).mockResolvedValue({
      notes: [],
      total: 0,
    });
  });

  it("닫힌 상태와 캐시 무효화 때 조회하지 않고 열면 조회한다", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const noteId = "11111111-1111-4111-8111-111111111111";
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender, unmount } = renderHook(
      ({ open }) =>
        useRelatedNoteCandidates({
          noteId,
          page: 1,
          search: "",
          enabled: open,
        }),
      { wrapper, initialProps: { open: false } },
    );
    try {
      expect(result.current.fetchStatus).toBe("idle");
      expect(getRelatedNoteCandidates).not.toHaveBeenCalled();

      rerender({ open: true });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(getRelatedNoteCandidates).toHaveBeenCalledTimes(1);

      rerender({ open: false });
      await client.invalidateQueries({
        queryKey: relatedNotesQueryKeys.candidates(noteId, 1, "", 8),
      });
      expect(getRelatedNoteCandidates).toHaveBeenCalledTimes(1);

      rerender({ open: true });
      await waitFor(() =>
        expect(getRelatedNoteCandidates).toHaveBeenCalledTimes(2),
      );
    } finally {
      unmount();
      client.clear();
    }
  });
});
