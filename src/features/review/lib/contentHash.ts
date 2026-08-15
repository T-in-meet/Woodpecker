import { createHash } from "node:crypto";

/**
 * 채점 기준 원본을 식별하는 값. `notes.updated_at`을 대신한다.
 *
 * `updated_at`은 notes 행의 모든 UPDATE에 붙는 `tr_notes_updated_at`(BEFORE UPDATE)
 * 트리거가 올린다. `update_notification_time_of_day`처럼 본문과 무관한 수정에도 바뀌므로,
 * 그때마다 채점을 거부하면 사용자는 아직 어디에도 저장되지 않은 답안을 통째로 잃는다.
 * 본문만 보는 해시로 바꾸면 이 오탐이 사라진다.
 *
 * 위조 가능성은 `updated_at`과 같다. 자기 노트를 자기가 채점받는 흐름이라
 * 보안 경계가 아니라 정합성 장치다.
 *
 * 값은 소문자 16진수 64자리다. DB의 review_gradings_graded_content_hash_check와
 * 액션 스키마의 정규식이 같은 형식을 기대한다.
 */
export function hashNoteContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}
