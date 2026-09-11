import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteChatComposer } from "./NoteChatComposer";

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";

function setCoarsePointer(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
  })) as unknown as typeof window.matchMedia;
}

function renderComposer(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  render(
    <NoteChatComposer
      conversationId={CONVERSATION_ID}
      dailyUsage={null}
      isStreaming={false}
      isAnswerGenerating={false}
      onCancel={vi.fn()}
      onSubmit={onSubmit}
    />,
  );

  return {
    onSubmit,
    textarea: screen.getByRole("textbox", {
      name: "노트 챗봇 질문",
    }),
  };
}

describe("NoteChatComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setCoarsePointer(false);
  });

  it("fine pointer 환경에서는 Enter로 질문을 전송한다", async () => {
    const { onSubmit, textarea } = renderComposer();

    fireEvent.change(textarea, {
      target: {
        value: "테스트 질문",
      },
    });

    fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith("테스트 질문");
    });
  });

  it("coarse pointer 환경에서는 Enter로 질문을 전송하지 않는다", () => {
    setCoarsePointer(true);

    const { onSubmit, textarea } = renderComposer();

    fireEvent.change(textarea, {
      target: {
        value: "테스트 질문",
      },
    });

    const wasNotCanceled = fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
    });

    expect(wasNotCanceled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
