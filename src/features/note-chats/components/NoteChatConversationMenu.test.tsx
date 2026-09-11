import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteChatConversationMenu } from "./NoteChatConversationMenu";

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";

const {
  deleteMutateAsyncMock,
  deleteResetMock,
  pushMock,
  updateMutateAsyncMock,
  updateResetMock,
} = vi.hoisted(() => ({
  deleteMutateAsyncMock: vi.fn(),
  deleteResetMock: vi.fn(),
  pushMock: vi.fn(),
  updateMutateAsyncMock: vi.fn(),
  updateResetMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("../hooks/use-update-note-chat-conversation-title-mutation", () => ({
  useUpdateNoteChatConversationTitleMutation: () => ({
    error: null,
    isPending: false,
    mutateAsync: updateMutateAsyncMock,
    reset: updateResetMock,
  }),
}));

vi.mock("../hooks/use-delete-note-chat-conversation-mutation", () => ({
  useDeleteNoteChatConversationMutation: () => ({
    error: null,
    isPending: false,
    mutateAsync: deleteMutateAsyncMock,
    reset: deleteResetMock,
  }),
}));

function setCoarsePointer(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
  })) as unknown as typeof window.matchMedia;
}

describe("NoteChatConversationMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCoarsePointer(false);

    updateMutateAsyncMock.mockResolvedValue({
      id: CONVERSATION_ID,
      title: "수정된 제목",
    });

    deleteMutateAsyncMock.mockResolvedValue(CONVERSATION_ID);
  });

  it("제목 수정 Input에서 Enter를 누르면 RHF 검증 후 제목을 수정한다", async () => {
    const user = userEvent.setup();

    render(
      <NoteChatConversationMenu
        conversationId={CONVERSATION_ID}
        title="기존 제목"
      />,
    );

    await user.click(screen.getByRole("button", { name: "대화 메뉴" }));

    await user.click(
      await screen.findByRole("menuitem", { name: "제목 수정" }),
    );

    const titleInput = await screen.findByRole("textbox", {
      name: "대화 제목",
    });

    expect(titleInput).toHaveValue("기존 제목");

    await user.clear(titleInput);
    await user.type(titleInput, "  수정된 제목  ");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(updateMutateAsyncMock).toHaveBeenCalledWith({
        conversationId: CONVERSATION_ID,
        title: "수정된 제목",
      });
    });
  });
});
