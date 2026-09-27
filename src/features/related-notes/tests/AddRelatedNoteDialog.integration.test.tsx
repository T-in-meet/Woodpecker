import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LazyAddRelatedNoteDialog } from "@/features/related-notes/components/LazyAddRelatedNoteDialog";

const { candidates, mutateAsync } = vi.hoisted(() => ({
  candidates: vi.fn(),
  mutateAsync: vi.fn(),
}));

vi.mock("@/features/related-notes/hooks/use-related-note-candidates", () => ({
  useRelatedNoteCandidates: candidates,
}));
vi.mock("@/features/related-notes/hooks/use-add-manual-related-notes", () => ({
  useAddManualRelatedNotes: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const noteId = "11111111-1111-4111-8111-111111111111";
const relatedNoteId = "22222222-2222-4222-8222-222222222222";

describe("관련 노트 지연 로딩과 폼 연결", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutateAsync.mockReset().mockResolvedValue({ success: true });
    candidates.mockReturnValue({
      data: { notes: [{ id: relatedNoteId, title: "후보 노트" }], total: 1 },
      isLoading: false,
      isFetching: false,
    });
  });

  it("열 때만 후보를 조회하고 취소 후 다시 열면 검색과 선택이 초기화된다", async () => {
    const user = userEvent.setup();
    render(<LazyAddRelatedNoteDialog noteId={noteId} />);
    expect(candidates).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "관련 노트 추가" }));
    const search = await screen.findByRole("textbox", { name: "노트 검색" });
    await waitFor(() => expect(search).toHaveFocus());
    await user.type(search, "검색어");
    await user.click(screen.getByRole("button", { name: "노트 검색" }));
    await user.click(
      screen.getByRole("checkbox", { name: "후보 노트 관련 노트 선택" }),
    );
    expect(screen.getByRole("button", { name: "추가" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    const closedCallCount = candidates.mock.calls.length;

    await user.click(screen.getByRole("button", { name: "관련 노트 추가" }));
    expect(
      await screen.findByRole("textbox", { name: "노트 검색" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("checkbox", { name: "후보 노트 관련 노트 선택" }),
    ).not.toBeChecked();
    expect(screen.getByRole("button", { name: "추가" })).toBeDisabled();
    expect(candidates.mock.calls.length).toBeGreaterThan(closedCallCount);
    expect(candidates).toHaveBeenLastCalledWith({
      noteId,
      page: 1,
      search: "",
      pageSize: 6,
    });
  });

  it("저장 실패 시 선택을 유지하고 성공 후 닫으며 버튼에 초점을 복귀한다", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("저장 실패"));
    const user = userEvent.setup();
    render(<LazyAddRelatedNoteDialog noteId={noteId} />);
    const trigger = screen.getByRole("button", { name: "관련 노트 추가" });
    await user.click(trigger);
    await user.click(
      await screen.findByRole("checkbox", { name: "후보 노트 관련 노트 선택" }),
    );
    await user.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("checkbox", { name: "후보 노트 관련 노트 선택" }),
    ).toBeChecked();
    await user.click(screen.getByRole("button", { name: "추가" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mutateAsync).toHaveBeenLastCalledWith({
      noteId,
      relatedNotes: [{ relatedNoteId }],
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
