"use client";

import { useParams } from "next/navigation";

import { Card, CardContent } from "@/components/ui/card";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import {
  formatOperationalErrorFeatureLabel,
  formatOperationalErrorOperationLabel,
  formatOperationalErrorStageLabel,
} from "@/features/operational-errors/utils/format-operational-error-label";
import { ROUTES } from "@/lib/constants/routes";

import { AdminBreadcrumbDynamicItems } from "../../components/layout/AdminBreadcrumbDynamicItems";
import { useOperationalErrorDetail } from "../hooks/use-operational-error-detail";
import { AdminOperationalErrorContextCard } from "./AdminOperationalErrorContextCard";
import { AdminOperationalErrorHistoryCard } from "./AdminOperationalErrorHistoryCard";
import { AdminOperationalErrorInfoCard } from "./AdminOperationalErrorInfoCard";
import { AdminOperationalErrorStatusCard } from "./AdminOperationalErrorStatusCard";

export function AdminOperationalErrorDetailClient() {
  const params = useParams<{ operationalErrorId: string }>();
  const operationalErrorId = params.operationalErrorId;

  const { data, isError, isPending } =
    useOperationalErrorDetail(operationalErrorId);
  console.log("이력", data?.history);
  if (isPending) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          backHref={ROUTES.ADMIN.OPERATIONAL_ERRORS}
          backLabel="운영 오류 목록"
          title="운영 오류"
        />

        <div className="h-64 animate-pulse rounded-md border bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          backHref={ROUTES.ADMIN.OPERATIONAL_ERRORS}
          backLabel="운영 오류 목록"
          title="운영 오류"
        />

        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            운영 오류를 불러오지 못했습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  /**
   * 처리 이력은 최신순으로 정렬되어 있으므로
   * 첫 번째 항목을 가장 최근 처리 정보로 사용합니다.
   */
  const latestHistory = data.history[0] ?? null;

  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={[
          {
            label: data.errorCode || "상세",
          },
        ]}
        loading={false}
      />

      <AdminDetailPageHeader
        backHref={ROUTES.ADMIN.OPERATIONAL_ERRORS}
        backLabel="운영 오류 목록"
        description={`${formatOperationalErrorFeatureLabel(
          data.feature,
        )} / ${formatOperationalErrorOperationLabel(
          data.operation,
        )} / ${formatOperationalErrorStageLabel(data.stage)}`}
        title={data.errorCode}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-6">
          <AdminOperationalErrorInfoCard operationalError={data} />

          <AdminOperationalErrorContextCard context={data.context} />
        </div>

        <div className="space-y-6">
          <AdminOperationalErrorHistoryCard history={data.history} />

          <AdminOperationalErrorStatusCard
            operationalErrorId={operationalErrorId}
            currentStatus={data.status}
            lastHandledAt={latestHistory?.createdAt ?? null}
            lastHandledByLabel={latestHistory?.changedByLabel ?? null}
          />
        </div>
      </div>
    </div>
  );
}
