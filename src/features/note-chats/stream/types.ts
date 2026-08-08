/**
 * 노트 챗봇 스트림이 시작됐음을 알리는 이벤트입니다.
 */
export type NoteChatStreamStartEvent = {
  runId: string;
  type: "start";
};

/**
 * AI가 생성한 텍스트 조각을 전달하는 이벤트입니다.
 */
export type NoteChatStreamTextDeltaEvent = {
  delta: string;
  type: "text-delta";
};

/**
 * 노트 챗봇 실행이 정상적으로 완료됐음을 알리는 이벤트입니다.
 */
export type NoteChatStreamFinishEvent = {
  assistantMessageId: string;
  usedNoteIds: string[];
  runId: string;
  type: "finish";
};

/**
 * 노트 챗봇 실행 중 오류가 발생했음을 알리는 이벤트입니다.
 */
export type NoteChatStreamErrorEvent = {
  message: string;
  runId: string;
  type: "error";
};

/**
 * Route Handler가 클라이언트에 전달하는 노트 챗봇 스트림 이벤트입니다.
 */
export type NoteChatStreamEvent =
  | NoteChatStreamStartEvent
  | NoteChatStreamTextDeltaEvent
  | NoteChatStreamFinishEvent
  | NoteChatStreamErrorEvent;
