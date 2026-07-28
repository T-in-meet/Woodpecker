import type { AdminBadgeConfig } from "@/features/admin/types/badge";
import type { AdminListConfig } from "@/features/admin/types/list";
import type { AdminSort } from "@/features/admin/types/sort";
import {
  OPERATIONAL_ERROR_SEVERITY,
  OPERATIONAL_ERROR_STATUS,
  type OperationalErrorSeverityType,
  type OperationalErrorStatusType,
} from "@/features/operational-errors/constants";

import type {
  OperationalErrorFilterField,
  OperationalErrorSearchField,
  OperationalErrorSortField,
} from "../types/operational-error-list";

const INITIAL_SORT: AdminSort<OperationalErrorSortField> = {
  direction: "desc",
  field: "lastSeenAt",
};

export const ADMIN_OPERATIONAL_ERROR_LIST_CONFIG = {
  filters: [
    {
      field: "status",
      label: "상태",
      options: [
        { label: "미해결", value: OPERATIONAL_ERROR_STATUS.OPEN },
        { label: "해결", value: OPERATIONAL_ERROR_STATUS.RESOLVED },
        { label: "무시", value: OPERATIONAL_ERROR_STATUS.IGNORED },
      ],
      placeholder: "상태를 선택하세요.",
      type: "multi-select",
    },
    {
      field: "severity",
      label: "심각도",
      options: [
        { label: "정보", value: OPERATIONAL_ERROR_SEVERITY.INFO },
        { label: "주의", value: OPERATIONAL_ERROR_SEVERITY.WARN },
        { label: "오류", value: OPERATIONAL_ERROR_SEVERITY.ERROR },
      ],
      placeholder: "심각도를 선택하세요.",
      type: "multi-select",
    },
    {
      field: "feature",
      label: "기능",
      options: [
        { label: "알림", value: "notifications" },
        { label: "Storage", value: "storage" },
      ],
      placeholder: "기능을 선택하세요.",
      type: "multi-select",
    },
    {
      field: "lastSeenAt",
      label: "최근 발생일",
      placeholder: "최근 발생일 범위를 선택하세요.",
      type: "date-range",
    },
    {
      field: "occurrenceCount",
      label: "발생",
      min: 1,
      placeholder: "발생 횟수 범위를 입력하세요.",
      step: 1,
      type: "number-range",
    },
  ],
  initialSort: INITIAL_SORT,
  pagination: {
    pageCount: 5,
    pageSize: 10,
  },
  search: {
    fields: [
      { label: "메시지", value: "message" },
      { label: "오류 코드", value: "errorCode" },
      { label: "기능", value: "feature" },
      { label: "작업", value: "operation" },
      { label: "단계", value: "stage" },
    ],
    initialField: "message",
  },
} as const satisfies AdminListConfig<
  OperationalErrorSearchField,
  OperationalErrorFilterField,
  OperationalErrorSortField
>;

export const OPERATIONAL_ERROR_STATUS_BADGE_CONFIG = {
  [OPERATIONAL_ERROR_STATUS.IGNORED]: { color: "gray", label: "무시" },
  [OPERATIONAL_ERROR_STATUS.OPEN]: { color: "yellow", label: "미해결" },
  [OPERATIONAL_ERROR_STATUS.RESOLVED]: { color: "green", label: "해결" },
} satisfies AdminBadgeConfig<OperationalErrorStatusType>;

export const OPERATIONAL_ERROR_SEVERITY_BADGE_CONFIG = {
  [OPERATIONAL_ERROR_SEVERITY.ERROR]: { color: "red", label: "오류" },
  [OPERATIONAL_ERROR_SEVERITY.INFO]: { color: "blue", label: "정보" },
  [OPERATIONAL_ERROR_SEVERITY.WARN]: { color: "yellow", label: "주의" },
} satisfies AdminBadgeConfig<OperationalErrorSeverityType>;

type OperationalErrorSortColumn =
  | "created_at"
  | "error_code"
  | "feature"
  | "last_seen_at"
  | "occurrence_count"
  | "operation"
  | "severity"
  | "stage"
  | "status";

export const ADMIN_OPERATIONAL_ERROR_SORT_COLUMN: Record<
  OperationalErrorSortField,
  OperationalErrorSortColumn
> = {
  createdAt: "created_at",
  errorCode: "error_code",
  feature: "feature",
  lastSeenAt: "last_seen_at",
  occurrenceCount: "occurrence_count",
  operation: "operation",
  severity: "severity",
  stage: "stage",
  status: "status",
};
