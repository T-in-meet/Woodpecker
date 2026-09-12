import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setCoarsePointer } from "../tests/utils/set-coarse-pointer";
import { NoteChatComposer } from "./NoteChatComposer";

const CONVERSATION_ID = "00000000-0000-4000-8000-000000000001";
const VIEWPORT_HEIGHT = 800;

function setVisualViewportHeight(height: number | null) {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value:
      height === null
        ? null
        : ({
            height,
          } as VisualViewport),
  });
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

    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: VIEWPORT_HEIGHT,
    });

    setVisualViewportHeight(VIEWPORT_HEIGHT);
  });

  it("일반 상태에서 질문 입력창에 공통 전송 방법을 접근성 설명으로 연결한다", () => {
    render(
      <NoteChatComposer
        conversationId={CONVERSATION_ID}
        dailyUsage={null}
        isStreaming={false}
        isAnswerGenerating={false}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const textarea = screen.getByRole("textbox", {
      name: "노트 챗봇 질문",
    });

    const description = screen.getByText(
      "질문 보내기 버튼으로 질문을 전송할 수 있습니다.",
    );

    expect(description).toHaveAttribute(
      "id",
      "note-chat-question-accessible-description",
    );

    expect(textarea).toHaveAttribute(
      "aria-describedby",
      "note-chat-question-accessible-description",
    );
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

  it("coarse pointer 환경에서 소프트 키보드가 열려 있으면 Enter로 질문을 전송하지 않는다", () => {
    setCoarsePointer(true);
    setVisualViewportHeight(500);

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

  it("coarse pointer 환경에서도 소프트 키보드가 닫혀 있으면 Enter로 질문을 전송한다", async () => {
    setCoarsePointer(true);
    setVisualViewportHeight(VIEWPORT_HEIGHT);

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

  it("coarse pointer 환경에서 Visual Viewport API를 지원하지 않으면 기존처럼 Enter 전송을 막는다", () => {
    setCoarsePointer(true);
    setVisualViewportHeight(null);

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

  it("Shift + Enter는 질문을 전송하지 않고 기본 줄바꿈 동작을 유지한다", () => {
    const { onSubmit, textarea } = renderComposer();

    fireEvent.change(textarea, {
      target: {
        value: "테스트 질문",
      },
    });

    const wasNotCanceled = fireEvent.keyDown(textarea, {
      key: "Enter",
      code: "Enter",
      shiftKey: true,
    });

    expect(wasNotCanceled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
