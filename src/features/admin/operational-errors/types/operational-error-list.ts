import type { AdminListToolbarFilters } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminSearchValue } from "@/features/admin/types/search";
import type { AdminSort } from "@/features/admin/types/sort";
import type {
  OperationalErrorSeverityType,
  OperationalErrorStatusType,
} from "@/features/operational-errors/constants";

/**
 * 운영 오류 목록에서 검색할 수 있는 필드입니다.
 */
export type OperationalErrorSearchField =
  | "errorCode"
  | "feature"
  | "message"
  | "operation"
  | "stage";

/**
 * 운영 오류 목록에서 필터링할 수 있는 필드입니다.
 */
export type OperationalErrorFilterField =
  | "feature"
  | "lastSeenAt"
  | "occurrenceCount"
  | "severity"
  | "status";

/**
 * 운영 오류 목록에서 정렬할 수 있는 필드입니다.
 */
export type OperationalErrorSortField =
  | "createdAt"
  | "errorCode"
  | "feature"
  | "lastSeenAt"
  | "occurrenceCount"
  | "operation"
  | "severity"
  | "stage"
  | "status";

/**
 * 운영 오류 목록을 조회할 때 사용하는 검색 조건입니다.
 *
 * 검색, 필터, 정렬 및 페이지네이션 상태를 포함합니다.
 */
export type OperationalErrorListQuery = {
  /** 현재 적용된 운영 오류 필터 */
  filters: AdminListToolbarFilters<OperationalErrorFilterField>;

  /** 조회할 페이지 번호 */
  page: number;

  /** 한 페이지에 표시할 항목 수 */
  pageSize: number;

  /** 현재 적용된 검색 필드와 검색어 */
  search: AdminSearchValue<OperationalErrorSearchField>;

  /** 현재 적용된 정렬 필드와 방향 */
  sort: AdminSort<OperationalErrorSortField>;
};

/**
 * 운영 오류 목록에 표시하는 개별 오류 항목입니다.
 *
 * 동일한 Fingerprint를 가진 OPEN 오류는 하나의 항목으로 집계되며,
 * 발생 횟수와 마지막 발생 시각이 갱신됩니다.
 */
export type OperationalErrorListItem = {
  /** 운영 오류 ID */
  id: string;

  /** 운영 오류 레코드가 처음 생성된 시각 */
  createdAt: string;

  /** 오류 종류를 식별하는 애플리케이션 오류 코드 */
  errorCode: string;

  /** 오류가 발생한 기능 영역 */
  feature: string;

  /** 동일한 오류를 식별하고 집계하기 위한 해시값 */
  fingerprint: string;

  /** 동일 오류가 가장 최근에 발생한 시각 */
  lastSeenAt: string;

  /** 관리자 화면에 표시할 오류 설명 */
  message: string;

  /** 동일 오류가 발생한 누적 횟수 */
  occurrenceCount: number;

  /** 오류가 발생한 작업 */
  operation: string;

  /** 오류의 심각도 */
  severity: OperationalErrorSeverityType;

  /** 작업 내부에서 오류가 발생한 세부 단계 */
  stage: string;

  /** 운영 오류의 현재 처리 상태 */
  status: OperationalErrorStatusType;

  /** 오류의 영향을 받은 사용자 ID */
  userId: string | null;
};

/**
 * 운영 오류 목록 조회 결과입니다.
 */
export type OperationalErrorListResult = {
  /** 현재 페이지에 표시할 운영 오류 목록 */
  items: OperationalErrorListItem[];

  /** 운영 오류 목록의 페이지네이션 정보 */
  pagination: {
    /** 현재 페이지 번호 */
    page: number;

    /** 한 페이지에 표시하는 항목 수 */
    pageSize: number;

    /** 검색 및 필터 조건에 해당하는 전체 항목 수 */
    total: number;

    /** 전체 페이지 수 */
    totalPages: number;
  };
};

/**
 * 운영 오류 상세 화면에 표시하는 정보입니다.
 *
 * 목록 항목에 오류 발생 주체, 영향받은 사용자, 해결 정보와
 * 상태 변경 이력을 추가로 포함합니다.
 */
export type OperationalErrorDetail = OperationalErrorListItem & {
  /** 오류가 발생한 작업을 수행한 사용자 또는 관리자 ID */
  actorUserId: string | null;

  /** 오류 발생 주체를 화면에 표시하기 위한 이름 또는 이메일 */
  actorUserLabel: string | null;

  /** 오류 분석에 필요한 추가 실행 정보 */
  context: unknown;

  /** 해당 오류가 최초로 발생한 시각 */
  firstSeenAt: string;

  /** 운영 오류의 상태 변경 이력 */
  history: OperationalErrorStatusHistoryItem[];

  /** 해결 또는 무시 처리 시 관리자가 남긴 메모 */
  resolutionNote: string | null;

  /** 오류가 해결되거나 무시 처리된 시각 */
  resolvedAt: string | null;

  /** 오류를 해결 또는 무시 처리한 관리자 ID */
  resolvedBy: string | null;

  /** 처리한 관리자를 화면에 표시하기 위한 이름 또는 이메일 */
  resolvedByLabel: string | null;

  /** 운영 오류 레코드가 마지막으로 수정된 시각 */
  updatedAt: string;

  /** 오류의 영향을 받은 사용자를 표시하기 위한 이름 또는 이메일 */
  userLabel: string | null;
};

/**
 * 운영 오류 상태가 변경된 내역입니다.
 */
export type OperationalErrorStatusHistoryItem = {
  /** 상태를 변경한 관리자 ID */
  changedBy: string | null;

  /** 상태를 변경한 관리자를 표시하기 위한 이름 또는 이메일 */
  changedByLabel: string | null;

  /** 상태가 변경된 시각 */
  createdAt: string;

  /** 변경 이전 상태 */
  fromStatus: OperationalErrorStatusType | null;

  /** 상태 변경 시 관리자가 남긴 메모 */
  note: string | null;

  /** 변경된 상태 */
  toStatus: OperationalErrorStatusType;

  /** 상태 변경 이력 ID */
  id: string;
};
