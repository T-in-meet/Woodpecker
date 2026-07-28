import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableHead } from "@/components/ui/table";
import { AdminBadge } from "@/features/admin/components/common/AdminBadge";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { AdminSortableTableHead } from "@/features/admin/components/common/AdminSortableTableHead";
import type { AdminSort } from "@/features/admin/types/sort";

import {
  USER_AGREEMENT_STATUS_BADGE_CONFIG,
  USER_SIGNUP_METHOD_BADGE_CONFIG,
} from "../constants/user-list";
import type { AdminUserListItem, UserSortField } from "../types/user-list";
import { AdminUserRoleSelect } from "./AdminUserRoleSelect";
import { AdminUserTableSkeleton } from "./AdminUserTableSkeleton";

interface AdminUserTableProps {
  /** 현재 페이지에 표시할 사용자 목록 */
  users: AdminUserListItem[];

  /** 현재 로그인한 관리자 ID */
  currentAdminId: string;

  /** 최초 목록 조회 진행 여부 */
  isPending: boolean;

  /** 목록 조회 실패 여부 */
  isError: boolean;

  /** 현재 적용된 정렬 조건 */
  sort: AdminSort<UserSortField>;

  /** 정렬 조건 변경 이벤트 */
  onSortChange: (sort: AdminSort<UserSortField>) => void;
}

/**
 * 관리자 사용자 목록을 테이블 형태로 표시합니다.
 *
 * 사용자 역할은 목록에서 직접 변경할 수 있으며,
 * 현재 로그인한 관리자의 역할 Select는 비활성화합니다.
 */
export function AdminUserTable({
  users,
  currentAdminId,
  isPending,
  isError,
  sort,
  onSortChange,
}: AdminUserTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-240 text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <AdminSortableTableHead
                field="nickname"
                sort={sort}
                onSortChange={onSortChange}
              >
                사용자
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="email"
                sort={sort}
                onSortChange={onSortChange}
              >
                이메일
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="role"
                sort={sort}
                onSortChange={onSortChange}
              >
                역할
              </AdminSortableTableHead>

              <TableHead>가입 방법</TableHead>

              <TableHead>약관 동의</TableHead>

              <AdminSortableTableHead
                field="createdAt"
                sort={sort}
                onSortChange={onSortChange}
              >
                가입일
              </AdminSortableTableHead>
            </tr>
          </thead>

          <tbody>
            {isPending ? (
              <AdminUserTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={6}>
                  <AdminListError description="사용자 목록을 불러오지 못했습니다." />
                </td>
              </tr>
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 align-middle">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage
                          src={user.avatarUrl ?? undefined}
                          alt={user.nickname}
                        />
                        <AvatarFallback>
                          {getAvatarFallback(user.nickname)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0">
                        <div
                          className="truncate font-medium"
                          title={user.nickname}
                        >
                          {user.nickname}
                        </div>

                        <div
                          className="truncate text-xs text-muted-foreground"
                          title={user.id}
                        >
                          {user.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="max-w-64 px-4 py-3 align-middle">
                    <div className="truncate" title={user.email ?? undefined}>
                      {user.email ?? (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <AdminUserRoleSelect
                      userId={user.id}
                      role={user.role}
                      disabled={user.id === currentAdminId}
                    />
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <UserSignupMethodBadge signupMethod={user.signupMethod} />
                  </td>

                  <td className="px-4 py-3 align-middle">
                    <UserAgreementStatusBadge
                      agreementStatus={user.agreementStatus}
                    />
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-middle">
                    {formatDateTime(user.createdAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <AdminListEmpty description="검색 조건과 일치하는 사용자가 없습니다." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 사용자 가입 방법을 목록 배지로 표시합니다.
 */
function UserSignupMethodBadge({
  signupMethod,
}: {
  signupMethod: AdminUserListItem["signupMethod"];
}) {
  const badge = USER_SIGNUP_METHOD_BADGE_CONFIG[signupMethod];

  return <AdminBadge color={badge.color}>{badge.label}</AdminBadge>;
}

/**
 * 사용자 약관 동의 상태를 목록 배지로 표시합니다.
 */
function UserAgreementStatusBadge({
  agreementStatus,
}: {
  agreementStatus: AdminUserListItem["agreementStatus"];
}) {
  const badge = USER_AGREEMENT_STATUS_BADGE_CONFIG[agreementStatus];

  return <AdminBadge color={badge.color}>{badge.label}</AdminBadge>;
}

/**
 * 사용자 닉네임에서 Avatar fallback 문자를 생성합니다.
 */
function getAvatarFallback(nickname: string) {
  return nickname.trim().slice(0, 2).toUpperCase();
}

/**
 * 가입일을 관리자 화면 표기 형식으로 변환합니다.
 */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
