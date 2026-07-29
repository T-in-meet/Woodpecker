import type { AdminBadgeConfig } from "@/features/admin/types/badge";
import type { AdminListConfig } from "@/features/admin/types/list";
import type { AdminSort } from "@/features/admin/types/sort";
import {
  OPERATIONAL_ERROR_FEATURE_LABELS,
  OPERATIONAL_ERROR_SEVERITY,
  OPERATIONAL_ERROR_STATUS,
  type OperationalErrorSeverityType,
  type OperationalErrorStatusType,
} from "@/features/operational-errors/constants";
import {
  formatOperationalErrorSeverityLabel,
  formatOperationalErrorStatusLabel,
} from "@/features/operational-errors/utils/format-operational-error-label";

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
      options: Object.values(OPERATIONAL_ERROR_STATUS).map((status) => ({
        label: formatOperationalErrorStatusLabel(status),
        value: status,
      })),
      placeholder: "상태를 선택하세요.",
      type: "multi-select",
    },
    {
      field: "severity",
      label: "심각도",
      options: Object.values(OPERATIONAL_ERROR_SEVERITY).map((severity) => ({
        label: formatOperationalErrorSeverityLabel(severity),
        value: severity,
      })),
      placeholder: "심각도를 선택하세요.",
      type: "multi-select",
    },
    {
      field: "feature",
      label: "기능",
      options: Object.entries(OPERATIONAL_ERROR_FEATURE_LABELS).map(
        ([value, label]) => ({
          label,
          value,
        }),
      ),
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
  [OPERATIONAL_ERROR_STATUS.IGNORED]: {
    color: "gray",
    label: formatOperationalErrorStatusLabel(OPERATIONAL_ERROR_STATUS.IGNORED),
  },
  [OPERATIONAL_ERROR_STATUS.OPEN]: {
    color: "yellow",
    label: formatOperationalErrorStatusLabel(OPERATIONAL_ERROR_STATUS.OPEN),
  },
  [OPERATIONAL_ERROR_STATUS.RESOLVED]: {
    color: "green",
    label: formatOperationalErrorStatusLabel(OPERATIONAL_ERROR_STATUS.RESOLVED),
  },
} satisfies AdminBadgeConfig<OperationalErrorStatusType>;

export const OPERATIONAL_ERROR_SEVERITY_BADGE_CONFIG = {
  [OPERATIONAL_ERROR_SEVERITY.ERROR]: {
    color: "red",
    label: formatOperationalErrorSeverityLabel(
      OPERATIONAL_ERROR_SEVERITY.ERROR,
    ),
  },
  [OPERATIONAL_ERROR_SEVERITY.INFO]: {
    color: "blue",
    label: formatOperationalErrorSeverityLabel(OPERATIONAL_ERROR_SEVERITY.INFO),
  },
  [OPERATIONAL_ERROR_SEVERITY.WARN]: {
    color: "yellow",
    label: formatOperationalErrorSeverityLabel(OPERATIONAL_ERROR_SEVERITY.WARN),
  },
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
