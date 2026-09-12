import type { AdminListToolbarFilters } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminSearchValue } from "@/features/admin/types/search";

import type { AdminSort } from "../../types/sort";

/** feedbacks.category DB 제약과 동일한 피드백 카테고리입니다. */
export type FeedbackCategory = "BUG" | "FEATURE" | "ETC";

/** feedbacks.area DB 제약과 동일한 피드백 기능 영역입니다. */
export type FeedbackArea =
  | "NOTE"
  | "REVIEW"
  | "AI"
  | "NOTIFICATION"
  | "ACCOUNT"
  | "ETC";

/** feedbacks.status DB 제약과 동일한 피드백 처리 상태입니다. */
export type FeedbackStatus = "OPEN" | "RESOLVED";

/** 관리자 피드백 목록에서 검색 가능한 필드입니다. */
export type FeedbackSearchField = "title" | "content" | "user";

/** 관리자 피드백 목록에서 필터링 가능한 필드입니다. */
export type FeedbackFilterField =
  | "category"
  | "area"
  | "status"
  | "createdAt"
  | "hasImages"
  | "noteLinked";

/** 관리자 피드백 목록에서 정렬 가능한 필드입니다. */
export type FeedbackSortField = "status" | "category" | "title" | "createdAt";

/**
 * 관리자 피드백 목록 Server Action에 전달하는 조회 조건입니다.
 */
export type AdminFeedbackListQuery = {
  /** 1부터 시작하는 현재 페이지 번호 */
  page: number;

  /** 한 페이지에 조회할 row 개수 */
  pageSize: number;

  /** 공통 관리자 검색 toolbar에서 적용된 검색 조건 */
  search: AdminSearchValue<FeedbackSearchField>;

  /** 공통 관리자 필터 toolbar에서 적용된 필터 조건 */
  filters: AdminListToolbarFilters<FeedbackFilterField>;

  /** 공통 관리자 toolbar에서 적용된 정렬 조건 */
  sort: AdminSort<FeedbackSortField>;
};

/**
 * 관리자 피드백 목록 테이블의 단일 row 표시 모델입니다.
 */
export type AdminFeedbackListItem = {
  /** feedbacks.id */
  id: string;

  /** feedbacks.user_id */
  userId: string;

  /** 목록에서 우선 표시할 사용자 닉네임 또는 fallback 식별자 */
  userLabel: string;

  /** 사용자 canonical email. 없으면 null */
  userEmail: string | null;

  /** 답변을 작성한 관리자 id. 아직 답변이 없으면 null */
  replyAuthorId: string | null;

  /** 답변 작성자 닉네임 또는 fallback 식별자. 아직 답변이 없으면 null */
  replyAuthorLabel: string | null;

  /** 연결된 notes.id. 연결이 없으면 null */
  noteId: string | null;

  /** 연결된 노트 제목. 연결 또는 조회 결과가 없으면 null */
  noteTitle: string | null;

  /** 피드백 카테고리 */
  category: FeedbackCategory;

  /** 피드백이 가리키는 기능 영역 */
  area: FeedbackArea;

  /** 피드백 처리 상태 */
  status: FeedbackStatus;

  /** 피드백 제목 */
  title: string;

  /** 목록에서 표시할 본문 축약 문자열 */
  contentPreview: string;

  /** 사용자 첨부 이미지 개수 */
  imageCount: number;

  /** 피드백 생성 시각 ISO 문자열 */
  createdAt: string;

  /** 피드백 수정 시각 ISO 문자열 */
  updatedAt: string;
};

/**
 * 관리자 피드백 목록 조회 결과입니다.
 */
export type AdminFeedbackListResult = {
  /** 현재 페이지에 표시할 목록 row */
  items: AdminFeedbackListItem[];

  /** 페이지네이션 계산에 필요한 메타데이터 */
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
