"use client";

import { AdminBadge } from "@/features/admin/components/common/AdminBadge";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { AdminSortableTableHead } from "@/features/admin/components/common/AdminSortableTableHead";
import type { AdminSort } from "@/features/admin/types/sort";

import {
  USER_GRADE_BADGE_CONFIG,
  USER_ROLE_BADGE_CONFIG,
  USER_STATUS_BADGE_CONFIG,
} from "../constants/mock-user-badge";
import type { MockUser } from "../types/mock-user";
import type { ComponentPlaygroundSortField } from "../types/sort";
import { MockUserTableSkeleton } from "./MockUserTableSkeleton";

const USER_STATUS_LABELS = {
  active: "활성",
  inactive: "비활성",
  suspended: "정지",
} as const;

const USER_ROLE_LABELS = {
  user: "사용자",
  editor: "편집자",
  manager: "매니저",
  admin: "관리자",
} as const;

const USER_GRADE_LABELS = {
  basic: "일반",
  premium: "프리미엄",
  vip: "VIP",
} as const;

type MockUserTableProps = {
  /** 현재 페이지에 표시할 Mock 사용자 목록 */
  users: MockUser[];

  /** 목록에 현재 적용된 정렬 조건 */
  sort: AdminSort<ComponentPlaygroundSortField>;

  /** 최초 사용자 목록 조회 여부 */
  isPending: boolean;

  /** 사용자 목록 조회 실패 여부 */
  isError: boolean;

  /** 목록 정렬 조건 변경 함수 */
  onSortChange: (sort: AdminSort<ComponentPlaygroundSortField>) => void;
};

/**
 * Component Playground에서 조회한 Mock 사용자 목록을 표시합니다.
 *
 * 목록의 로딩, 오류, 빈 결과 상태를 테이블 내부에서 함께 처리하며,
 * 정렬 가능한 헤더를 선택하면 상위 목록의 조회 조건을 변경합니다.
 */
export function MockUserTable({
  users,
  sort,
  isPending,
  isError,
  onSortChange,
}: MockUserTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <AdminSortableTableHead
              field="id"
              sort={sort}
              onSortChange={onSortChange}
              className="px-4 py-3 text-left font-medium"
            >
              ID
            </AdminSortableTableHead>

            <AdminSortableTableHead
              field="name"
              sort={sort}
              onSortChange={onSortChange}
              className="px-4 py-3 text-left font-medium"
            >
              이름
            </AdminSortableTableHead>

            <AdminSortableTableHead
              field="email"
              sort={sort}
              onSortChange={onSortChange}
              className="px-4 py-3 text-left font-medium"
            >
              이메일
            </AdminSortableTableHead>

            <AdminSortableTableHead
              field="status"
              sort={sort}
              onSortChange={onSortChange}
              className="px-4 py-3 text-left font-medium"
            >
              상태
            </AdminSortableTableHead>

            <th className="px-4 py-3 text-left font-medium">역할</th>

            <AdminSortableTableHead
              field="grade"
              sort={sort}
              onSortChange={onSortChange}
              className="px-4 py-3 text-left font-medium"
            >
              등급
            </AdminSortableTableHead>

            <AdminSortableTableHead
              field="score"
              sort={sort}
              onSortChange={onSortChange}
              className="px-4 py-3 text-left font-medium"
            >
              점수
            </AdminSortableTableHead>

            <AdminSortableTableHead
              field="createdAt"
              sort={sort}
              onSortChange={onSortChange}
              className="px-4 py-3 text-left font-medium"
            >
              가입일
            </AdminSortableTableHead>
          </tr>
        </thead>

        <tbody>
          {isPending ? (
            <MockUserTableSkeleton />
          ) : isError ? (
            <tr>
              <td colSpan={8}>
                <AdminListError description="사용자 목록을 불러오지 못했습니다." />
              </td>
            </tr>
          ) : users.length > 0 ? (
            users.map((user) => {
              const statusBadge = USER_STATUS_BADGE_CONFIG[user.status];
              const gradeBadge = USER_GRADE_BADGE_CONFIG[user.grade];

              return (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{user.id}</td>
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>

                  <td className="px-4 py-3">
                    <AdminBadge color={statusBadge.color}>
                      {USER_STATUS_LABELS[user.status]}
                    </AdminBadge>
                  </td>

                  <td className="flex flex-col gap-2 px-4 py-3">
                    {user.roles.map((role) => {
                      const roleBadge = USER_ROLE_BADGE_CONFIG[role];

                      return (
                        <AdminBadge key={role} color={roleBadge.color}>
                          {USER_ROLE_LABELS[role]}
                        </AdminBadge>
                      );
                    })}
                  </td>

                  <td className="px-4 py-3">
                    <AdminBadge color={gradeBadge.color}>
                      {USER_GRADE_LABELS[user.grade]}
                    </AdminBadge>
                  </td>

                  <td className="px-4 py-3">{user.score}</td>

                  <td className="px-4 py-3">
                    {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8}>
                <AdminListEmpty description="검색 조건과 일치하는 사용자가 없습니다." />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
