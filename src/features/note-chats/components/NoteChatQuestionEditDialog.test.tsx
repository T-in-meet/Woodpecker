import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoteChatQuestionEditDialog } from "./NoteChatQuestionEditDialog";

const MESSAGE_ID = "00000000-0000-4000-8000-000000000002";

describe("NoteChatQuestionEditDialog", () => {
  it("수정한 질문을 RHF 검증 후 기존 질문 수정 흐름에 전달한다", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onUpdateQuestion = vi.fn().mockResolvedValue(undefined);

    render(
      <NoteChatQuestionEditDialog
        message={{
          id: MESSAGE_ID,
          sequenceNumber: 3,
          text: "기존 질문",
        }}
        onClose={onClose}
        onUpdateQuestion={onUpdateQuestion}
      />,
    );

    const textarea = screen.getByRole("textbox");

    await waitFor(() => {
      expect(textarea).toHaveValue("기존 질문");
    });

    await user.clear(textarea);
    await user.type(textarea, "  수정된 질문  ");

    await user.click(
      screen.getByRole("button", {
        name: "수정하고 다시 답변받기",
      }),
    );

    await waitFor(() => {
      expect(onUpdateQuestion).toHaveBeenCalledWith({
        messageId: MESSAGE_ID,
        question: "수정된 질문",
        sequenceNumber: 3,
      });
    });

    expect(onClose).toHaveBeenCalledOnce();
  });
});
