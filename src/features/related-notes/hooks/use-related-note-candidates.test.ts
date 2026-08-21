import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import { useRelatedNoteCandidates } from "./use-related-note-candidates";

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: vi.fn(),
}));

vi.mock("../queries", () => ({
  getRelatedNoteCandidates: vi.fn(),
}));

describe("useRelatedNoteCandidates", () => {
  it("페이지 변경 중 이전 후보 데이터를 유지한다", () => {
    vi.mocked(useQuery).mockReturnValue({} as never);

    useRelatedNoteCandidates({
      noteId: "11111111-1111-4111-8111-111111111111",
      page: 2,
      search: "검색어",
      pageSize: 6,
    });

    expect(useQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        placeholderData: keepPreviousData,
        queryKey: relatedNotesQueryKeys.candidates(
          "11111111-1111-4111-8111-111111111111",
          2,
          "검색어",
          6,
        ),
      }),
    );
  });
});
