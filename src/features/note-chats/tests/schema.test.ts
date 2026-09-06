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
  noteChatUserMessageContentSchema,
  updateNoteChatConversationTitleInputSchema,
  updateNoteChatUserMessageInputSchema,
} from "../schema";

const VALID_CONVERSATION_ID = "550e8400-e29b-41d4-a716-446655440001";
const VALID_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440002";
const VALID_NOTE_ID_1 = "550e8400-e29b-41d4-a716-446655440003";
const VALID_NOTE_ID_2 = "550e8400-e29b-41d4-a716-446655440004";

describe("noteChatConversationTitleSchema", () => {
  it("유효한 제목을 검증하고 앞뒤 공백을 제거한다", () => {
    const result = noteChatConversationTitleSchema.parse("  노트 챗봇  ");

    expect(result).toBe("노트 챗봇");
  });

  it("빈 제목을 거부한다", () => {
    expect(() => noteChatConversationTitleSchema.parse("   ")).toThrow(
      NOTE_CHAT_VALIDATION_MESSAGE.TITLE_REQUIRED,
    );
  });

  it("최대 길이를 초과한 제목을 거부한다", () => {
    const title = "a".repeat(NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH + 1);

    expect(() => noteChatConversationTitleSchema.parse(title)).toThrow(
      NOTE_CHAT_VALIDATION_MESSAGE.TITLE_MAX_LENGTH,
    );
  });

  it("최대 길이까지의 제목을 허용한다", () => {
    const title = "a".repeat(NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH);

    expect(noteChatConversationTitleSchema.parse(title)).toBe(title);
  });
});

describe("noteChatUserMessageContentSchema", () => {
  it("유효한 사용자 메시지를 검증하고 앞뒤 공백을 제거한다", () => {
    const result = noteChatUserMessageContentSchema.parse({
      text: "  질문입니다.  ",
    });

    expect(result).toEqual({
      text: "질문입니다.",
    });
  });

  it("빈 사용자 메시지를 거부한다", () => {
    expect(() =>
      noteChatUserMessageContentSchema.parse({
        text: "   ",
      }),
    ).toThrow(NOTE_CHAT_VALIDATION_MESSAGE.QUESTION_REQUIRED);
  });

  it("최대 길이를 초과한 사용자 메시지를 거부한다", () => {
    const text = "a".repeat(NOTE_CHAT_QUESTION_MAX_LENGTH + 1);

    expect(() =>
      noteChatUserMessageContentSchema.parse({
        text,
      }),
    ).toThrow(NOTE_CHAT_VALIDATION_MESSAGE.QUESTION_MAX_LENGTH);
  });

  it("최대 길이까지의 사용자 메시지를 허용한다", () => {
    const text = "a".repeat(NOTE_CHAT_QUESTION_MAX_LENGTH);

    expect(
      noteChatUserMessageContentSchema.parse({
        text,
      }),
    ).toEqual({
      text,
    });
  });
});

describe("noteChatAssistantMessageContentSchema", () => {
  it("Assistant 메시지와 사용된 Note UUID 목록을 검증한다", () => {
    const result = noteChatAssistantMessageContentSchema.parse({
      text: "  답변입니다.  ",
      usedNoteIds: [VALID_NOTE_ID_1, VALID_NOTE_ID_2],
    });

    expect(result).toEqual({
      text: "답변입니다.",
      usedNoteIds: [VALID_NOTE_ID_1, VALID_NOTE_ID_2],
    });
  });

  it("참고한 Note가 없으면 빈 UUID 배열을 허용한다", () => {
    const result = noteChatAssistantMessageContentSchema.parse({
      text: "답변입니다.",
      usedNoteIds: [],
    });

    expect(result).toEqual({
      text: "답변입니다.",
      usedNoteIds: [],
    });
  });

  it("Assistant 메시지가 비어 있으면 거부한다", () => {
    expect(() =>
      noteChatAssistantMessageContentSchema.parse({
        text: "   ",
        usedNoteIds: [],
      }),
    ).toThrow(NOTE_CHAT_VALIDATION_MESSAGE.ASSISTANT_MESSAGE_REQUIRED);
  });

  it("잘못된 Note ID를 거부한다", () => {
    expect(() =>
      noteChatAssistantMessageContentSchema.parse({
        text: "답변입니다.",
        usedNoteIds: ["not-a-uuid"],
      }),
    ).toThrow();
  });
});

describe("createNoteChatConversationInputSchema", () => {
  it("대화 생성 입력을 검증한다", () => {
    expect(
      createNoteChatConversationInputSchema.parse({
        title: "새 대화",
      }),
    ).toEqual({
      title: "새 대화",
    });
  });

  it("잘못된 제목을 거부한다", () => {
    expect(() =>
      createNoteChatConversationInputSchema.parse({
        title: "",
      }),
    ).toThrow();
  });
});

describe("createNoteChatQuestionInputSchema", () => {
  it("대화 ID와 사용자 질문을 검증한다", () => {
    expect(
      createNoteChatQuestionInputSchema.parse({
        conversationId: VALID_CONVERSATION_ID,
        content: {
          text: "질문입니다.",
        },
      }),
    ).toEqual({
      conversationId: VALID_CONVERSATION_ID,
      content: {
        text: "질문입니다.",
      },
    });
  });

  it("잘못된 대화 ID를 거부한다", () => {
    expect(() =>
      createNoteChatQuestionInputSchema.parse({
        conversationId: "invalid-id",
        content: {
          text: "질문입니다.",
        },
      }),
    ).toThrow(NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID);
  });
});

describe("updateNoteChatUserMessageInputSchema", () => {
  it("메시지 수정 입력을 검증한다", () => {
    expect(
      updateNoteChatUserMessageInputSchema.parse({
        messageId: VALID_MESSAGE_ID,
        content: {
          text: "수정된 질문",
        },
      }),
    ).toEqual({
      messageId: VALID_MESSAGE_ID,
      content: {
        text: "수정된 질문",
      },
    });
  });

  it("잘못된 메시지 ID를 거부한다", () => {
    expect(() =>
      updateNoteChatUserMessageInputSchema.parse({
        messageId: "invalid-id",
        content: {
          text: "수정된 질문",
        },
      }),
    ).toThrow(NOTE_CHAT_VALIDATION_MESSAGE.MESSAGE_ID_INVALID);
  });
});

describe("updateNoteChatConversationTitleInputSchema", () => {
  it("대화 제목 변경 입력을 검증한다", () => {
    expect(
      updateNoteChatConversationTitleInputSchema.parse({
        conversationId: VALID_CONVERSATION_ID,
        title: "수정된 제목",
      }),
    ).toEqual({
      conversationId: VALID_CONVERSATION_ID,
      title: "수정된 제목",
    });
  });

  it("잘못된 대화 ID를 거부한다", () => {
    expect(() =>
      updateNoteChatConversationTitleInputSchema.parse({
        conversationId: "invalid-id",
        title: "수정된 제목",
      }),
    ).toThrow(NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID);
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

  it("잘못된 대화 ID를 거부한다", () => {
    expect(() =>
      deleteNoteChatConversationInputSchema.parse({
        conversationId: "invalid-id",
      }),
    ).toThrow(NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID);
  });
});
