import { AdminBadge } from "../../components/common/AdminBadge";
import { OPERATIONAL_ERROR_STATUS_BADGE_CONFIG } from "../constants/operational-error-list";
import { OperationalErrorStatusHistoryItem } from "../types/operational-error-list";

export function OperationalErrorStatusBadge({
  status,
}: {
  status: OperationalErrorStatusHistoryItem["toStatus"];
}) {
  const badge = OPERATIONAL_ERROR_STATUS_BADGE_CONFIG[status];

  return <AdminBadge color={badge.color}>{badge.label}</AdminBadge>;
}
