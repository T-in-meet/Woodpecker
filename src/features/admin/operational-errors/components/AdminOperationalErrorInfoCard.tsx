import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminBadge } from "@/features/admin/components/common/AdminBadge";
import {
  formatOperationalErrorCodeLabel,
  formatOperationalErrorFeatureLabel,
  formatOperationalErrorOperationLabel,
  formatOperationalErrorStageLabel,
} from "@/features/operational-errors/utils/format-operational-error-label";
import { formatDateTime } from "@/lib/utils/formatDate";

import {
  OPERATIONAL_ERROR_SEVERITY_BADGE_CONFIG,
  OPERATIONAL_ERROR_STATUS_BADGE_CONFIG,
} from "../constants/operational-error-list";
import type { OperationalErrorDetail } from "../types/operational-error-list";

interface AdminOperationalErrorInfoCardProps {
  /** 화면에 표시할 운영 오류 상세 정보 */
  operationalError: OperationalErrorDetail;
}

/**
 * 운영 오류의 상태, 심각도 및 발생 정보를 표시합니다.
 */
export function AdminOperationalErrorInfoCard({
  operationalError,
}: AdminOperationalErrorInfoCardProps) {
  const statusBadge =
    OPERATIONAL_ERROR_STATUS_BADGE_CONFIG[operationalError.status];
  const severityBadge =
    OPERATIONAL_ERROR_SEVERITY_BADGE_CONFIG[operationalError.severity];

  return (
    <Card>
      <CardHeader>
        <CardTitle>오류 정보</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <AdminBadge color={statusBadge.color}>{statusBadge.label}</AdminBadge>

          <AdminBadge color={severityBadge.color}>
            {severityBadge.label}
          </AdminBadge>
        </div>

        <DetailGrid
          items={[
            [
              "기능",
              formatOperationalErrorFeatureLabel(operationalError.feature),
            ],
            [
              "작업",
              formatOperationalErrorOperationLabel(operationalError.operation),
            ],
            ["단계", formatOperationalErrorStageLabel(operationalError.stage)],
            [
              "오류 코드",
              formatOperationalErrorCodeLabel(operationalError.errorCode),
            ],
            ["사용자", operationalError.userLabel ?? "-"],
            ["작업자", operationalError.actorUserLabel ?? "-"],
            ["Fingerprint", operationalError.fingerprint],
            [
              "발생 횟수",
              `${operationalError.occurrenceCount.toLocaleString("ko-KR")}회`,
            ],
            ["최초 발생", formatDateTime(operationalError.firstSeenAt)],
            ["최근 발생", formatDateTime(operationalError.lastSeenAt)],
            ["등록일", formatDateTime(operationalError.createdAt)],
            ["수정일", formatDateTime(operationalError.updatedAt)],
          ]}
        />

        <div>
          <h3 className="text-sm font-semibold">메시지</h3>

          <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted px-3 py-2 text-sm">
            {operationalError.message}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0 rounded-md border px-3 py-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>

          <dd className="mt-1 line-clamp-2 break-all text-sm font-medium">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
