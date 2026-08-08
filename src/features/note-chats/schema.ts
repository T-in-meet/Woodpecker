import { z } from "zod";

import {
  NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH,
  NOTE_CHAT_QUESTION_MAX_LENGTH,
  NOTE_CHAT_VALIDATION_MESSAGE,
} from "./constants";

/**
 * 노트 챗봇 대화 제목을 검증합니다.
 *
 * 앞뒤 공백을 제거한 제목이 비어 있지 않아야 하며,
 * 데이터베이스 제약조건과 동일하게 최대 50자까지 허용합니다.
 */
export const noteChatConversationTitleSchema = z
  .string()
  .trim()
  .min(1, NOTE_CHAT_VALIDATION_MESSAGE.TITLE_REQUIRED)
  .max(
    NOTE_CHAT_CONVERSATION_TITLE_MAX_LENGTH,
    NOTE_CHAT_VALIDATION_MESSAGE.TITLE_MAX_LENGTH,
  );

/**
 * 사용자가 작성한 노트 챗봇 메시지의 `content`를 검증합니다.
 *
 * 검증이 끝난 `text`는 앞뒤 공백이 제거된 상태로 반환됩니다.
 */
export const noteChatUserMessageContentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, NOTE_CHAT_VALIDATION_MESSAGE.QUESTION_REQUIRED)
    .max(
      NOTE_CHAT_QUESTION_MAX_LENGTH,
      NOTE_CHAT_VALIDATION_MESSAGE.QUESTION_MAX_LENGTH,
    ),
});

/**
 * AI가 생성한 노트 챗봇 메시지의 `content`를 검증합니다.
 *
 * `referencedNoteIds`에는 답변 생성 과정에서 참고한 노트의
 * id를 순서대로 저장합니다. 참고한 노트가 없으면 빈 배열을 사용합니다.
 */
export const noteChatAssistantMessageContentSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, NOTE_CHAT_VALIDATION_MESSAGE.ASSISTANT_MESSAGE_REQUIRED),
  referencedNoteIds: z.array(z.string().uuid()),
});

/**
 * 새로운 노트 챗봇 대화를 생성할 때 사용하는 입력을 검증합니다.
 */
export const createNoteChatConversationInputSchema = z.object({
  title: noteChatConversationTitleSchema,
});

/**
 * 기존 대화에 새로운 사용자 질문을 생성할 때 사용하는 입력을 검증합니다.
 *
 * AI 실행 설정은 클라이언트 입력으로 받지 않고
 * 서버의 AI Runtime Configuration에서 확정합니다.
 */
export const createNoteChatQuestionInputSchema = z.object({
  conversationId: z
    .string()
    .uuid(NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID),
  content: noteChatUserMessageContentSchema,
});

/**
 * 기존 사용자 메시지를 수정할 때 사용하는 입력을 검증합니다.
 *
 * 메시지를 수정하면 해당 메시지 이후의 대화 흐름이 삭제되며,
 * 새로운 AI 실행 설정은 서버의 AI Runtime Configuration에서 확정합니다.
 */
export const updateNoteChatUserMessageInputSchema = z.object({
  messageId: z.string().uuid(NOTE_CHAT_VALIDATION_MESSAGE.MESSAGE_ID_INVALID),
  content: noteChatUserMessageContentSchema,
});

/**
 * 노트 챗봇 대화 제목을 변경할 때 사용하는 입력을 검증합니다.
 */
export const updateNoteChatConversationTitleInputSchema = z.object({
  conversationId: z
    .string()
    .uuid(NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID),
  title: noteChatConversationTitleSchema,
});

/**
 * 노트 챗봇 대화를 삭제할 때 사용하는 입력을 검증합니다.
 */
export const deleteNoteChatConversationInputSchema = z.object({
  conversationId: z
    .string()
    .uuid(NOTE_CHAT_VALIDATION_MESSAGE.CONVERSATION_ID_INVALID),
});

/**
 * 새로운 노트 챗봇 대화를 생성할 때 사용하는 입력 타입입니다.
 */
export type CreateNoteChatConversationInput = z.infer<
  typeof createNoteChatConversationInputSchema
>;

/**
 * 기존 대화에 새로운 질문을 추가할 때 사용하는 입력 타입입니다.
 */
export type CreateNoteChatQuestionInput = z.infer<
  typeof createNoteChatQuestionInputSchema
>;

/**
 * 기존 사용자 메시지를 수정할 때 사용하는 입력 타입입니다.
 */
export type UpdateNoteChatUserMessageInput = z.infer<
  typeof updateNoteChatUserMessageInputSchema
>;

/**
 * 노트 챗봇 대화 제목을 변경할 때 사용하는 입력 타입입니다.
 */
export type UpdateNoteChatConversationTitleInput = z.infer<
  typeof updateNoteChatConversationTitleInputSchema
>;

/**
 * 노트 챗봇 대화를 삭제할 때 사용하는 입력 타입입니다.
 */
export type DeleteNoteChatConversationInput = z.infer<
  typeof deleteNoteChatConversationInputSchema
>;
