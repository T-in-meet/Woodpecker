import type { Database } from "@/types/database.types";

/** 생성된 DB 타입에서 가져온 AI Run row 계약입니다. */
type AiRunRow = Database["public"]["Tables"]["ai_runs"]["Row"];

/** migration의 CHECK constraint가 허용하는 AI 기능 식별자입니다. */
export const AI_RUN_FEATURE_TYPE = {
  NOTE_CHAT: "note-chat",
  QUIZ_GENERATION: "quiz-generation",
  RELATED_NOTES: "related-notes",
  REVIEW_GRADING: "review-grading",
} as const satisfies Record<string, AiRunRow["feature_type"]>;

/** AI Run이 지원하는 기능 식별자 타입입니다. */
export type AiRunFeatureType =
  (typeof AI_RUN_FEATURE_TYPE)[keyof typeof AI_RUN_FEATURE_TYPE];

/** migration의 CHECK constraint가 허용하는 AI Run lifecycle 상태입니다. */
export const AI_RUN_STATUS = {
  FAILED: "failed",
  RUNNING: "running",
  STALE: "stale",
  SUCCEEDED: "succeeded",
} as const satisfies Record<string, AiRunRow["status"]>;

/** 요청 경로에서 저장하는 AI Run 종료 상태 타입입니다. */
export type AiRunTerminalStatus =
  | typeof AI_RUN_STATUS.FAILED
  | typeof AI_RUN_STATUS.SUCCEEDED;

/** 현재 메모리 상태를 검증된 Snapshot 문서로 만드는 함수입니다. */
export type AiRunSnapshotBuilder = () => unknown;

/** AI Run 생성 입력입니다. */
export type CreateAiRunParams = {
  /** 생성 직전에 초기 Snapshot을 build하고 검증하는 함수입니다. */
  buildSnapshot: AiRunSnapshotBuilder;

  /** 실행할 AI 기능 식별자입니다. */
  featureType: AiRunFeatureType;

  /** 실제 AI 실행 시작 시각의 ISO 문자열입니다. */
  startedAt: string;

  /** application-layer 인증·인가를 완료한 사용자 ID입니다. */
  userId: string;
};

/** AI Run checkpoint 저장 입력입니다. */
export type CheckpointAiRunParams = {
  /** checkpoint 시점의 전체 Snapshot을 build하고 검증하는 함수입니다. */
  buildSnapshot: AiRunSnapshotBuilder;

  /** 생성 실패 시 null인 AI Run ID입니다. */
  aiRunId: string | null;

  /** Run 소유권 guard에 사용하는 사용자 ID입니다. */
  userId: string;
};

/** AI Run terminal 저장의 공통 입력입니다. */
export type CompleteAiRunParams = CheckpointAiRunParams & {
  /** terminal 상태를 확정한 시각의 ISO 문자열입니다. */
  completedAt: string;
};

/** 성공한 AI Run terminal 저장 입력입니다. */
export type CompleteAiRunSucceededParams = CompleteAiRunParams & {
  /** 이번 실행이 실제 저장한 사용자 노출 결과 UUID 목록입니다. */
  featureResultIds: string[];
};
