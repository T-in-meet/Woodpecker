import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteChatCreateDialog } from "./NoteChatCreateDialog";

const { createMutateAsyncMock, createResetMock, pushMock } = vi.hoisted(() => ({
  createMutateAsyncMock: vi.fn(),
  createResetMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("../hooks/use-create-note-chat-conversation-mutation", () => ({
  useCreateNoteChatConversationMutation: () => ({
    error: null,
    isPending: false,
    mutateAsync: createMutateAsyncMock,
    reset: createResetMock,
  }),
}));

function setCoarsePointer(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
  })) as unknown as typeof window.matchMedia;
}

describe("NoteChatCreateDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCoarsePointer(false);
  });

  it("취소하면 입력값과 mutation 상태를 초기화한다", async () => {
    const user = userEvent.setup();

    render(<NoteChatCreateDialog />);

    await user.click(
      screen.getByRole("button", {
        name: "새 대화",
      }),
    );

    const titleInput = await screen.findByRole("textbox", {
      name: "대화 제목",
    });

    await user.type(titleInput, "임시 대화 제목");

    expect(titleInput).toHaveValue("임시 대화 제목");

    await user.click(
      screen.getByRole("button", {
        name: "취소",
      }),
    );

    await waitFor(() => {
      expect(createResetMock).toHaveBeenCalled();
    });

    await user.click(
      screen.getByRole("button", {
        name: "새 대화",
      }),
    );

    const reopenedTitleInput = await screen.findByRole("textbox", {
      name: "대화 제목",
    });

    expect(reopenedTitleInput).toHaveValue("");
  });
});
