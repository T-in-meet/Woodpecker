import Link from "next/link";

import { TableHead } from "@/components/ui/table";
import { AdminBadge } from "@/features/admin/components/common/AdminBadge";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { AdminSortableTableHead } from "@/features/admin/components/common/AdminSortableTableHead";
import type { AdminSort } from "@/features/admin/types/sort";
import {
  getAdminAiAgentRoute,
  getAdminAiModelRoute,
  getAdminAiSettingsRoute,
} from "@/lib/constants/routes";
import { formatDate, formatDateTime } from "@/lib/utils/formatDate";

import {
  ADMIN_AI_SETTING_AGENT_BADGE_COLOR,
  ADMIN_AI_SETTING_CHAT_MODEL_BADGE_COLOR,
  ADMIN_AI_SETTING_EMBEDDING_MODEL_BADGE_COLOR,
} from "../constants/ai-settings-list";
import type {
  AdminAiSettingListItem,
  AdminAiSettingSortField,
} from "../types/ai-settings-list";
import { AdminAiSettingsTableSkeleton } from "./AdminAiSettingsTableSkeleton";

type AdminAiSettingsTableProps = {
  /** 현재 페이지에 표시할 AI 설정 목록 */
  settings: AdminAiSettingListItem[];

  /** 최초 목록 조회 진행 여부 */
  isPending: boolean;

  /** 목록 조회 실패 여부 */
  isError: boolean;

  /** 현재 적용된 정렬 조건 */
  sort: AdminSort<AdminAiSettingSortField>;

  /** 정렬 조건 변경 이벤트 */
  onSortChange: (sort: AdminSort<AdminAiSettingSortField>) => void;
};

/**
 * @description 관리자 AI 설정 목록을 테이블 형태로 표시합니다.
 * @param props AI 설정 목록 테이블 속성
 * @returns AI 설정 목록 테이블
 */
export function AdminAiSettingsTable({
  settings,
  isPending,
  isError,
  sort,
  onSortChange,
}: AdminAiSettingsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-280 text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <AdminSortableTableHead
                field="displayName"
                sort={sort}
                onSortChange={onSortChange}
              >
                설정 이름
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="key"
                sort={sort}
                onSortChange={onSortChange}
              >
                설정 키
              </AdminSortableTableHead>

              <TableHead>Agent</TableHead>
              <TableHead>Chat</TableHead>
              <TableHead>Embedding</TableHead>

              <AdminSortableTableHead
                field="createdAt"
                sort={sort}
                onSortChange={onSortChange}
              >
                생성일
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="updatedAt"
                sort={sort}
                onSortChange={onSortChange}
              >
                수정일
              </AdminSortableTableHead>
            </tr>
          </thead>

          <tbody>
            {isPending ? (
              <AdminAiSettingsTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={7}>
                  <AdminListError description="AI 설정 목록을 불러오지 못했습니다." />
                </td>
              </tr>
            ) : settings.length > 0 ? (
              settings.map((setting) => {
                const detailHref = getAdminAiSettingsRoute(setting.id);

                return (
                  <tr key={setting.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <Link
                        href={detailHref}
                        className="font-medium underline-offset-4 hover:underline"
                        title={`${setting.displayName} 상세 페이지로 이동`}
                      >
                        {setting.displayName}
                      </Link>
                    </td>

                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <Link
                        href={detailHref}
                        className="font-mono text-sm underline-offset-4 hover:underline"
                        title={`${setting.displayName} 상세 페이지로 이동`}
                      >
                        {setting.key}
                      </Link>
                    </td>

                    <td className="px-4 py-3 align-top">
                      <BadgeList
                        items={setting.agents}
                        color={ADMIN_AI_SETTING_AGENT_BADGE_COLOR}
                        type="agent"
                      />
                    </td>

                    <td className="px-4 py-3 align-top">
                      <BadgeList
                        items={setting.chatModels}
                        color={ADMIN_AI_SETTING_CHAT_MODEL_BADGE_COLOR}
                        type="model"
                      />
                    </td>

                    <td className="px-4 py-3 align-top">
                      <BadgeList
                        items={setting.embeddingModels}
                        color={ADMIN_AI_SETTING_EMBEDDING_MODEL_BADGE_COLOR}
                        type="model"
                      />
                    </td>

                    <td
                      className="px-4 py-3 align-top"
                      title={formatDateTime(setting.createdAt)}
                    >
                      {formatDate(setting.createdAt)}
                    </td>

                    <td
                      className="px-4 py-3 align-top"
                      title={formatDateTime(setting.updatedAt)}
                    >
                      {formatDate(setting.updatedAt)}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <AdminListEmpty description="검색 조건과 일치하는 AI 설정이 없습니다." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type BadgeListProps = {
  items: AdminAiSettingListItem["agents"];
  color:
    | typeof ADMIN_AI_SETTING_AGENT_BADGE_COLOR
    | typeof ADMIN_AI_SETTING_CHAT_MODEL_BADGE_COLOR
    | typeof ADMIN_AI_SETTING_EMBEDDING_MODEL_BADGE_COLOR;
  type: "agent" | "model";
};

/**
 * AI 설정에서 사용하는 Agent 또는 Model 목록을 배지로 표시합니다.
 */
function BadgeList({ items, color, type }: BadgeListProps) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex max-w-80 flex-wrap gap-1">
      {items.map((item) => {
        const link =
          type === "agent"
            ? getAdminAiAgentRoute(item.id)
            : getAdminAiModelRoute(item.id);
        const targetName = type === "agent" ? "에이전트" : "모델";

        return (
          <AdminBadge key={item.id} color={color} asChild>
            <Link
              href={link}
              title={`${item.displayName} ${targetName} 페이지로 이동`}
            >
              {item.displayName}
            </Link>
          </AdminBadge>
        );
      })}
    </div>
  );
}
