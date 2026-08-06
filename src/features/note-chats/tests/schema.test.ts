import { describe, expect, it } from "vitest";

import {
  NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH,
  NOTE_CHAT_QUESTION_MAX_LENGTH,
  NOTE_CHAT_VALIDATION_MESSAGE,
} from "../constants";
import {
  createNoteChatConversationInputSchema,
  createNoteChatQuestionInputSchema,
  deleteNoteChatConversationInputSchema,
  noteChatAssistantMessageContentSchema,
  noteChatConversationTitleSchema,
  noteChatRunSettingsSchema,
  noteChatUserMessageContentSchema,
  updateNoteChatConversationTitleInputSchema,
  updateNoteChatUserMessageInputSchema,
} from "../schema";

const VALID_CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";
const VALID_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const VALID_AGENT_ID = "33333333-3333-4333-8333-333333333333";
const VALID_PROMPT_VERSION_ID = "44444444-4444-4444-8444-444444444444";
const VALID_CHAT_MODEL_CONFIG_ID = "55555555-5555-4555-8555-555555555555";
const VALID_EMBEDDING_MODEL_CONFIG_ID = "66666666-6666-4666-8666-666666666666";

/**
 * 스키마 검증 실패 결과에서 첫 번째 오류 메시지를 반환합니다.
 */
function getFirstErrorMessage(result: {
  success: boolean;
  error?: {
    issues: Array<{
      message: string;
    }>;
  };
}): string | undefined {
  return result.error?.issues[0]?.message;
}

describe("noteChatConversationTitleSchema", () => {
  it("앞뒤 공백을 제거한 대화 제목을 반환한다", () => {
    const result = noteChatConversationTitleSchema.parse("  새 대화  ");

    expect(result).toBe("새 대화");
  });

  it("최대 길이의 대화 제목을 허용한다", () => {
    const title = "가".repeat(NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH);

    expect(noteChatConversationTitleSchema.parse(title)).toBe(title);
  });

  it("공백만 있는 대화 제목을 거부한다", () => {
    const result = noteChatConversationTitleSchema.safeParse("   ");

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.TITLE_REQUIRED,
    );
  });

  it("최대 길이를 초과한 대화 제목을 거부한다", () => {
    const result = noteChatConversationTitleSchema.safeParse(
      "가".repeat(NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH + 1),
    );

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.TITLE_MAX_LENGTH,
    );
  });
});

describe("noteChatUserMessageContentSchema", () => {
  it("앞뒤 공백을 제거한 사용자 메시지를 반환한다", () => {
    const result = noteChatUserMessageContentSchema.parse({
      text: "  질문입니다.  ",
    });

    expect(result).toEqual({
      text: "질문입니다.",
    });
  });

  it("최대 길이의 질문을 허용한다", () => {
    const text = "가".repeat(NOTE_CHAT_QUESTION_MAX_LENGTH);

    expect(
      noteChatUserMessageContentSchema.parse({
        text,
      }),
    ).toEqual({
      text,
    });
  });

  it("공백만 있는 질문을 거부한다", () => {
    const result = noteChatUserMessageContentSchema.safeParse({
      text: "   ",
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.QUESTION_REQUIRED,
    );
  });

  it("최대 길이를 초과한 질문을 거부한다", () => {
    const result = noteChatUserMessageContentSchema.safeParse({
      text: "가".repeat(NOTE_CHAT_QUESTION_MAX_LENGTH + 1),
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.QUESTION_MAX_LENGTH,
    );
  });
});

describe("noteChatAssistantMessageContentSchema", () => {
  it("AI 답변과 참고 노트 순위를 검증한다", () => {
    const result = noteChatAssistantMessageContentSchema.parse({
      text: "  답변입니다.  ",
      referencedNoteRanks: [1, 3],
    });

    expect(result).toEqual({
      text: "답변입니다.",
      referencedNoteRanks: [1, 3],
    });
  });

  it("참고 노트가 없는 빈 배열을 허용한다", () => {
    const result = noteChatAssistantMessageContentSchema.parse({
      text: "참고한 노트가 없습니다.",
      referencedNoteRanks: [],
    });

    expect(result.referencedNoteRanks).toEqual([]);
  });

  it("공백만 있는 AI 답변을 거부한다", () => {
    const result = noteChatAssistantMessageContentSchema.safeParse({
      text: "   ",
      referencedNoteRanks: [],
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.ASSISTANT_MESSAGE_REQUIRED,
    );
  });

  it.each([0, -1, 1.5])(
    "양의 정수가 아닌 참고 노트 순위 %s를 거부한다",
    (rank) => {
      const result = noteChatAssistantMessageContentSchema.safeParse({
        text: "답변입니다.",
        referencedNoteRanks: [rank],
      });

      expect(result.success).toBe(false);
    },
  );
});

describe("noteChatRunSettingsSchema", () => {
  it("모든 AI 설정 ID를 허용한다", () => {
    const settings = {
      agentId: VALID_AGENT_ID,
      promptVersionId: VALID_PROMPT_VERSION_ID,
      chatModelConfigId: VALID_CHAT_MODEL_CONFIG_ID,
      embeddingModelConfigId: VALID_EMBEDDING_MODEL_CONFIG_ID,
    };

    expect(noteChatRunSettingsSchema.parse(settings)).toEqual(settings);
  });

  it("빈 설정 객체를 허용한다", () => {
    expect(noteChatRunSettingsSchema.parse({})).toEqual({});
  });

  it("각 AI 설정에 null을 허용한다", () => {
    const settings = {
      agentId: null,
      promptVersionId: null,
      chatModelConfigId: null,
      embeddingModelConfigId: null,
    };

    expect(noteChatRunSettingsSchema.parse(settings)).toEqual(settings);
  });

  it.each([
    "agentId",
    "promptVersionId",
    "chatModelConfigId",
    "embeddingModelConfigId",
  ] as const)("유효하지 않은 %s를 거부한다", (field) => {
    const result = noteChatRunSettingsSchema.safeParse({
      [field]: "invalid-id",
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.AI_SETTING_ID_INVALID,
    );
  });
});

describe("createNoteChatConversationInputSchema", () => {
  it("대화 생성 입력을 검증하고 제목의 공백을 제거한다", () => {
    const result = createNoteChatConversationInputSchema.parse({
      title: "  새로운 대화  ",
    });

    expect(result).toEqual({
      title: "새로운 대화",
    });
  });

  it("빈 대화 제목을 거부한다", () => {
    const result = createNoteChatConversationInputSchema.safeParse({
      title: "",
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.TITLE_REQUIRED,
    );
  });
});

describe("createNoteChatQuestionInputSchema", () => {
  it("새 질문 생성 입력을 검증한다", () => {
    const input = {
      conversationId: VALID_CONVERSATION_ID,
      content: {
        text: "질문입니다.",
      },
      settings: {
        agentId: VALID_AGENT_ID,
      },
    };

    expect(createNoteChatQuestionInputSchema.parse(input)).toEqual(input);
  });

  it("settings가 없는 입력을 허용한다", () => {
    const input = {
      conversationId: VALID_CONVERSATION_ID,
      content: {
        text: "질문입니다.",
      },
    };

    expect(createNoteChatQuestionInputSchema.parse(input)).toEqual(input);
  });

  it("유효하지 않은 대화 ID를 거부한다", () => {
    const result = createNoteChatQuestionInputSchema.safeParse({
      conversationId: "invalid-id",
      content: {
        text: "질문입니다.",
      },
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID,
    );
  });
});

describe("updateNoteChatUserMessageInputSchema", () => {
  it("사용자 메시지 수정 입력을 검증한다", () => {
    const input = {
      messageId: VALID_MESSAGE_ID,
      content: {
        text: "수정된 질문입니다.",
      },
      settings: {
        chatModelConfigId: VALID_CHAT_MODEL_CONFIG_ID,
      },
    };

    expect(updateNoteChatUserMessageInputSchema.parse(input)).toEqual(input);
  });

  it("유효하지 않은 메시지 ID를 거부한다", () => {
    const result = updateNoteChatUserMessageInputSchema.safeParse({
      messageId: "invalid-id",
      content: {
        text: "수정된 질문입니다.",
      },
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.MESSAGE_ID_INVALID,
    );
  });
});

describe("updateNoteChatConversationTitleInputSchema", () => {
  it("대화 제목 수정 입력을 검증하고 제목의 공백을 제거한다", () => {
    const result = updateNoteChatConversationTitleInputSchema.parse({
      conversationId: VALID_CONVERSATION_ID,
      title: "  수정된 제목  ",
    });

    expect(result).toEqual({
      conversationId: VALID_CONVERSATION_ID,
      title: "수정된 제목",
    });
  });

  it("유효하지 않은 대화 ID를 거부한다", () => {
    const result = updateNoteChatConversationTitleInputSchema.safeParse({
      conversationId: "invalid-id",
      title: "수정된 제목",
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID,
    );
  });
});

describe("deleteNoteChatConversationInputSchema", () => {
  it("대화 삭제 입력을 검증한다", () => {
    expect(
      deleteNoteChatConversationInputSchema.parse({
        conversationId: VALID_CONVERSATION_ID,
      }),
    ).toEqual({
      conversationId: VALID_CONVERSATION_ID,
    });
  });

  it("유효하지 않은 대화 ID를 거부한다", () => {
    const result = deleteNoteChatConversationInputSchema.safeParse({
      conversationId: "invalid-id",
    });

    expect(result.success).toBe(false);
    expect(getFirstErrorMessage(result)).toBe(
      NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID,
    );
  });
});
