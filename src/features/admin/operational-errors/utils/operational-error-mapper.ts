import type {
  OperationalErrorListItem,
  OperationalErrorStatusHistoryItem,
} from "../types/operational-error-list";
import type {
  OperationalErrorListRow,
  OperationalErrorStatusHistoryRow,
} from "../types/operational-error-query";

export function mapOperationalErrorRow(
  row: OperationalErrorListRow,
): OperationalErrorListItem {
  return {
    createdAt: row.created_at,
    errorCode: row.error_code,
    feature: row.feature,
    fingerprint: row.fingerprint,
    id: row.id,
    lastSeenAt: row.last_seen_at,
    message: row.message,
    occurrenceCount: row.occurrence_count,
    operation: row.operation,
    severity: row.severity,
    stage: row.stage,
    status: row.status,
    userId: row.user_id,
  };
}

export function mapHistoryRow(
  row: OperationalErrorStatusHistoryRow,
  profileLabels: Map<string, string>,
): OperationalErrorStatusHistoryItem {
  return {
    changedBy: row.changed_by,
    changedByLabel: row.changed_by
      ? (profileLabels.get(row.changed_by) ?? row.changed_by)
      : null,
    createdAt: row.created_at,
    fromStatus: row.from_status,
    id: row.id,
    note: row.note,
    toStatus: row.to_status,
  };
}
