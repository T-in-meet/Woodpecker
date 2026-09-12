import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";

import type { NoteChatMessage } from "../types";
import { NoteChatMessageList } from "./NoteChatMessageList";

vi.mock("./NoteChatAssistantMessage", () => ({
  NoteChatAssistantMessage: ({ text }: { text: string }) => (
    <li data-testid="assistant-message">{text}</li>
  ),
}));

vi.mock("./NoteChatStreamStatus", () => ({
  NoteChatStreamStatus: ({
    streamingContent,
  }: {
    streamingContent: string;
    isAnswerGenerating: boolean;
  }) =>
    streamingContent.length > 0 ? (
      <li data-testid="streaming-message">{streamingContent}</li>
    ) : null,
}));

vi.mock("./NoteChatEmptyState", () => ({
  NoteChatEmptyState: () => <div>빈 대화</div>,
}));

vi.mock("./NoteChatDailyExecutionLimitError", () => ({
  NoteChatDailyExecutionLimitError: () => <div>일일 실행 제한 오류</div>,
}));

vi.mock("./NoteChatStreamError", () => ({
  NoteChatStreamError: () => <div>스트리밍 오류</div>,
}));

vi.mock("./NoteChatQuestionEditDialog", () => ({
  NoteChatQuestionEditDialog: () => null,
}));

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ASSISTANT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

function createUserMessage({
  id = USER_MESSAGE_ID,
  text = "저장된 사용자 질문",
  sequenceNumber = 1,
}: {
  id?: string;
  text?: string;
  sequenceNumber?: number;
} = {}): NoteChatMessage {
  return {
    id,
    conversation_id: CONVERSATION_ID,
    role: AI_CHAT_MESSAGE_ROLE.USER,
    sequence_number: sequenceNumber,
    content: {
      text,
    },
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  } as unknown as NoteChatMessage;
}

function createAssistantMessage({
  id = ASSISTANT_MESSAGE_ID,
  text = "저장된 Assistant 답변",
  sequenceNumber = 2,
}: {
  id?: string;
  text?: string;
  sequenceNumber?: number;
} = {}): NoteChatMessage {
  return {
    id,
    conversation_id: CONVERSATION_ID,
    role: AI_CHAT_MESSAGE_ROLE.ASSISTANT,
    sequence_number: sequenceNumber,
    content: {
      text,
      usedNoteIds: [],
    },
    created_at: "2026-09-01T00:00:01.000Z",
    updated_at: "2026-09-01T00:00:01.000Z",
  } as unknown as NoteChatMessage;
}

function createDefaultProps() {
  return {
    assistantSources: [],
    dailyUsage: {
      used: 0,
      limit: 10,
    },
    onUpdateQuestion: vi.fn().mockResolvedValue(undefined),
  };
}

describe("NoteChatMessageList", () => {
  it("저장된 User와 Assistant 메시지를 렌더링한다", () => {
    render(
      <NoteChatMessageList
        {...createDefaultProps()}
        messages={[createUserMessage(), createAssistantMessage()]}
      />,
    );

    expect(screen.getByText("저장된 사용자 질문")).toBeInTheDocument();
    expect(screen.getByText("저장된 Assistant 답변")).toBeInTheDocument();
  });

  it("pending 질문과 같은 ID의 저장된 User 메시지는 중복 렌더링하지 않는다", () => {
    render(
      <NoteChatMessageList
        {...createDefaultProps()}
        messages={[
          createUserMessage({
            text: "수정 전 저장 질문",
          }),
        ]}
        pendingQuestion="수정 중인 질문"
        pendingQuestionMessageId={USER_MESSAGE_ID}
      />,
    );

    expect(screen.queryByText("수정 전 저장 질문")).not.toBeInTheDocument();
    expect(screen.getByText("수정 중인 질문")).toBeInTheDocument();
  });

  it("스트리밍 Assistant와 같은 ID의 저장된 Assistant 메시지는 중복 렌더링하지 않는다", () => {
    render(
      <NoteChatMessageList
        {...createDefaultProps()}
        messages={[
          createUserMessage(),
          createAssistantMessage({
            text: "이미 Query에 반영된 Assistant 답변",
          }),
        ]}
        streamingContent="현재 스트리밍 답변"
        streamingAssistantMessageId={ASSISTANT_MESSAGE_ID}
        isStreaming
        isAnswerGenerating
      />,
    );

    expect(
      screen.queryByText("이미 Query에 반영된 Assistant 답변"),
    ).not.toBeInTheDocument();

    expect(screen.getByTestId("streaming-message")).toHaveTextContent(
      "현재 스트리밍 답변",
    );
  });

  it("저장 User와 pending User DOM을 각각 Message ID와 null semantic target으로 등록한다", () => {
    const registerUserMessageElement = vi.fn();

    render(
      <NoteChatMessageList
        {...createDefaultProps()}
        messages={[createUserMessage()]}
        pendingQuestion="아직 저장되지 않은 질문"
        registerUserMessageElement={registerUserMessageElement}
      />,
    );

    expect(registerUserMessageElement).toHaveBeenCalledWith(
      USER_MESSAGE_ID,
      expect.any(HTMLLIElement),
    );

    expect(registerUserMessageElement).toHaveBeenCalledWith(
      null,
      expect.any(HTMLLIElement),
    );
  });

  it("스트리밍 rerender에서도 동일한 저장 User DOM ref를 불필요하게 재등록하지 않는다", () => {
    const registerUserMessageElement = vi.fn();
    const defaultProps = createDefaultProps();
    const messages = [createUserMessage()];

    const { rerender } = render(
      <NoteChatMessageList
        {...defaultProps}
        messages={messages}
        streamingContent="답"
        isStreaming
        isAnswerGenerating
        registerUserMessageElement={registerUserMessageElement}
      />,
    );

    expect(registerUserMessageElement).toHaveBeenCalledTimes(1);
    expect(registerUserMessageElement).toHaveBeenCalledWith(
      USER_MESSAGE_ID,
      expect.any(HTMLLIElement),
    );

    registerUserMessageElement.mockClear();

    /*
     * 실제 스트리밍처럼 content만 증가하여 MessageList가 다시 렌더링됩니다.
     *
     * 동일 User DOM의 callback ref identity가 유지되어야 하므로
     * 기존 ref의 null 해제와 새 ref의 element 재등록이 발생하면 안 됩니다.
     */
    rerender(
      <NoteChatMessageList
        {...defaultProps}
        messages={messages}
        streamingContent="답변"
        isStreaming
        isAnswerGenerating
        registerUserMessageElement={registerUserMessageElement}
      />,
    );

    expect(registerUserMessageElement).not.toHaveBeenCalled();
  });
});
