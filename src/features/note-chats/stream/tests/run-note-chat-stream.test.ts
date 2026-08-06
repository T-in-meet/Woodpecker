import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AiChatStreamEvent,
  AiChatStreamResult,
} from "@/features/ai/providers/types";

import { executeNoteChat } from "../../execution/execute";
import {
  completeNoteChatRunFailure,
  completeNoteChatRunSuccess,
  markNoteChatRunRunning,
} from "../../execution/run-persistence";
import type { NoteChatRunSettings } from "../../schema";
import { runNoteChatStream } from "../run-note-chat-stream";
import type { NoteChatStreamEvent } from "../types";

vi.mock("../../execution/execute", () => ({
  executeNoteChat: vi.fn(),
}));

vi.mock("../../execution/run-persistence", () => ({
  completeNoteChatRunFailure: vi.fn(),
  completeNoteChatRunSuccess: vi.fn(),
  markNoteChatRunRunning: vi.fn(),
}));

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const RUN_ID = "33333333-3333-4333-8333-333333333333";
const ASSISTANT_MESSAGE_ID = "44444444-4444-4444-8444-444444444444";

const SETTINGS: NoteChatRunSettings = {
  agentId: "55555555-5555-4555-8555-555555555555",
  promptVersionId: "66666666-6666-4666-8666-666666666666",
  chatModelConfigId: "77777777-7777-4777-8777-777777777777",
  embeddingModelConfigId: "88888888-8888-4888-8888-888888888888",
};

const USAGE = {
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
};

const FINISH_RESULT: AiChatStreamResult = {
  content: "완성된 답변",
  metadata: {
    provider: "openai",
  },
  usage: USAGE,
};

/**
 * 테스트용 Provider 스트림을 생성합니다.
 *
 * @param events 순서대로 반환할 Provider 이벤트
 * @returns Provider 공통 AsyncGenerator
 */
async function* createProviderStream(
  events: AiChatStreamEvent[],
): AsyncGenerator<AiChatStreamEvent> {
  for (const event of events) {
    yield event;
  }
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(markNoteChatRunRunning).mockResolvedValue();
  vi.mocked(completeNoteChatRunSuccess).mockResolvedValue(ASSISTANT_MESSAGE_ID);
  vi.mocked(completeNoteChatRunFailure).mockResolvedValue();
});

describe("runNoteChatStream", () => {
  it("Run 시작부터 Provider 스트림 소비와 성공 저장까지 처리한다", async () => {
    vi.mocked(executeNoteChat).mockResolvedValue({
      prepared: {} as never,
      providerStream: createProviderStream([
        {
          delta: "완성된 ",
          type: "text-delta",
        },
        {
          delta: "답변",
          type: "text-delta",
        },
        {
          result: FINISH_RESULT,
          type: "finish",
        },
      ]),
      referencedNoteIds: [],
      sources: [],
    });

    const events: NoteChatStreamEvent[] = [];

    const result = await runNoteChatStream(
      {
        conversationId: CONVERSATION_ID,
        runId: RUN_ID,
        settings: SETTINGS,
        userMessageId: USER_MESSAGE_ID,
      },
      (event) => {
        events.push(event);
      },
    );

    expect(markNoteChatRunRunning).toHaveBeenCalledWith(RUN_ID);

    expect(executeNoteChat).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      settings: SETTINGS,
      userMessageId: USER_MESSAGE_ID,
    });

    expect(completeNoteChatRunSuccess).toHaveBeenCalledWith({
      content: "완성된 답변",
      referencedNoteIds: [],
      runId: RUN_ID,
      sources: [],
      usage: USAGE,
    });

    expect(completeNoteChatRunFailure).not.toHaveBeenCalled();

    expect(events).toEqual([
      {
        runId: RUN_ID,
        type: "start",
      },
      {
        delta: "완성된 ",
        type: "text-delta",
      },
      {
        delta: "답변",
        type: "text-delta",
      },
      {
        assistantMessageId: ASSISTANT_MESSAGE_ID,
        referencedNoteIds: [],
        runId: RUN_ID,
        type: "finish",
      },
    ]);

    expect(result).toEqual({
      assistantMessageId: ASSISTANT_MESSAGE_ID,
      content: "완성된 답변",
      referencedNoteIds: [],
      runId: RUN_ID,
      usage: USAGE,
    });
  });

  it("Provider 실행이 실패하면 Run을 실패 처리하고 오류 이벤트를 전달한다", async () => {
    vi.mocked(executeNoteChat).mockRejectedValue(
      new Error("Provider execution failed"),
    );

    const events: NoteChatStreamEvent[] = [];

    await expect(
      runNoteChatStream(
        {
          conversationId: CONVERSATION_ID,
          runId: RUN_ID,
          settings: SETTINGS,
          userMessageId: USER_MESSAGE_ID,
        },
        (event) => {
          events.push(event);
        },
      ),
    ).rejects.toThrow("Provider execution failed");

    expect(completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: RUN_ID,
      usage: null,
    });

    expect(events).toEqual([
      {
        runId: RUN_ID,
        type: "start",
      },
      {
        message: "답변 생성에 실패했습니다.",
        runId: RUN_ID,
        type: "error",
      },
    ]);
  });

  it("성공 결과 저장이 실패하면 확인된 usage로 Run 실패 처리를 시도한다", async () => {
    vi.mocked(executeNoteChat).mockResolvedValue({
      prepared: {} as never,
      providerStream: createProviderStream([
        {
          delta: "완성된 답변",
          type: "text-delta",
        },
        {
          result: FINISH_RESULT,
          type: "finish",
        },
      ]),
      referencedNoteIds: [],
      sources: [],
    });

    vi.mocked(completeNoteChatRunSuccess).mockRejectedValue(
      new Error("Success persistence failed"),
    );

    await expect(
      runNoteChatStream(
        {
          conversationId: CONVERSATION_ID,
          runId: RUN_ID,
          settings: SETTINGS,
          userMessageId: USER_MESSAGE_ID,
        },
        vi.fn(),
      ),
    ).rejects.toThrow("Success persistence failed");

    expect(completeNoteChatRunFailure).toHaveBeenCalledWith({
      runId: RUN_ID,
      usage: USAGE,
    });
  });

  it("Run 시작 처리에 실패하면 Provider를 실행하지 않는다", async () => {
    vi.mocked(markNoteChatRunRunning).mockRejectedValue(
      new Error("Run start failed"),
    );

    await expect(
      runNoteChatStream(
        {
          conversationId: CONVERSATION_ID,
          runId: RUN_ID,
          settings: SETTINGS,
          userMessageId: USER_MESSAGE_ID,
        },
        vi.fn(),
      ),
    ).rejects.toThrow("Run start failed");

    expect(executeNoteChat).not.toHaveBeenCalled();
    expect(completeNoteChatRunFailure).not.toHaveBeenCalled();
  });

  it("실패 완료 저장 오류가 원래 실행 오류를 덮어쓰지 않는다", async () => {
    vi.mocked(executeNoteChat).mockRejectedValue(
      new Error("Original execution failed"),
    );

    vi.mocked(completeNoteChatRunFailure).mockRejectedValue(
      new Error("Failure persistence failed"),
    );

    await expect(
      runNoteChatStream(
        {
          conversationId: CONVERSATION_ID,
          runId: RUN_ID,
          settings: SETTINGS,
          userMessageId: USER_MESSAGE_ID,
        },
        vi.fn(),
      ),
    ).rejects.toThrow("Original execution failed");
  });
});
