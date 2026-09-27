import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AddRelatedNoteDialogProps } from "@/features/related-notes/components/AddRelatedNoteDialog";
import { LazyAddRelatedNoteDialog } from "@/features/related-notes/components/LazyAddRelatedNoteDialog";

function LoadedDialog({ onClose }: AddRelatedNoteDialogProps) {
  return (
    <DialogContent>
      <DialogTitle>관련 노트 추가</DialogTitle>
      <DialogDescription>후보 선택</DialogDescription>
      <button type="button" onClick={onClose}>
        취소
      </button>
    </DialogContent>
  );
}

type DialogModule = { AddRelatedNoteDialog: typeof LoadedDialog };
const loadModule = vi.fn<() => Promise<DialogModule>>();
const noteId = "11111111-1111-4111-8111-111111111111";

describe("LazyAddRelatedNoteDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadModule
      .mockReset()
      .mockResolvedValue({ AddRelatedNoteDialog: LoadedDialog });
    vi.doMock("@/features/related-notes/components/AddRelatedNoteDialog", () =>
      loadModule(),
    );
  });

  it("클릭 전에는 모듈을 불러오지 않고 한 번의 클릭으로 열며 닫으면 버튼에 초점을 돌린다", async () => {
    const user = userEvent.setup();
    render(<LazyAddRelatedNoteDialog noteId={noteId} />);
    const trigger = screen.getByRole("button", { name: "관련 노트 추가" });
    expect(trigger).toBeEnabled();
    expect(loadModule).not.toHaveBeenCalled();

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "취소" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    expect(await screen.findByRole("button", { name: "취소" })).toBeVisible();
    expect(loadModule).toHaveBeenCalledTimes(1);
  });

  it("로딩 중 닫으면 다운로드 완료 후에도 다시 열리지 않는다", async () => {
    let resolveModule!: (module: DialogModule) => void;
    loadModule.mockReturnValue(
      new Promise((resolve) => {
        resolveModule = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<LazyAddRelatedNoteDialog noteId={noteId} />);
    const trigger = screen.getByRole("button", { name: "관련 노트 추가" });

    await user.click(trigger);
    expect(await screen.findByRole("status")).toHaveTextContent("불러오는 중");
    await user.keyboard("{Escape}");
    await act(async () => {
      resolveModule({ AddRelatedNoteDialog: LoadedDialog });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    await user.click(trigger);
    expect(await screen.findByRole("button", { name: "취소" })).toBeVisible();
    expect(loadModule).toHaveBeenCalledTimes(1);
  });

  it("모듈 로딩 실패를 대화상자 안에 표시하고 재시도할 수 있다", async () => {
    const getComponent = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("Chunk load failed");
      })
      .mockReturnValue(LoadedDialog);
    loadModule.mockResolvedValue({
      get AddRelatedNoteDialog() {
        return getComponent();
      },
    });
    const user = userEvent.setup();
    render(<LazyAddRelatedNoteDialog noteId={noteId} />);

    await user.click(screen.getByRole("button", { name: "관련 노트 추가" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "화면을 불러오지 못했습니다",
    );
    await user.click(screen.getByRole("button", { name: "다시 시도" }));
    expect(await screen.findByRole("button", { name: "취소" })).toBeVisible();
  });
});
