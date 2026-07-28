import type { Json } from "@/types/db.helpers";

import type {
  OperationalErrorListItem,
  OperationalErrorStatusHistoryItem,
} from "./operational-error-list";

/**
 * 운영 오류 목록 및 상세 조회에 사용하는 데이터베이스 행 타입입니다.
 */
export type OperationalErrorRow = {
  actor_user_id: string | null;
  context: Json;
  created_at: string;
  error_code: string;
  feature: string;
  fingerprint: string;
  first_seen_at: string;
  id: string;
  last_seen_at: string;
  message: string;
  occurrence_count: number;
  operation: string;
  resolution_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  severity: OperationalErrorListItem["severity"];
  stage: string;
  status: OperationalErrorListItem["status"];
  updated_at: string;
  user_id: string | null;
};

/**
 * 사용자 ID와 표시용 닉네임을 조회한 프로필 행 타입입니다.
 */
export type ProfileLabelRow = {
  id: string;
  nickname: string;
};

/**
 * 운영 오류 상태 변경 이력의 데이터베이스 행 타입입니다.
 */
export type OperationalErrorStatusHistoryRow = {
  changed_by: string | null;
  created_at: string;
  from_status: OperationalErrorStatusHistoryItem["fromStatus"];
  id: string;
  note: string | null;
  to_status: OperationalErrorStatusHistoryItem["toStatus"];
};
