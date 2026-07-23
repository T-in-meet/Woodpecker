"use client";

import { useMemo, useState } from "react";

import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";

import { MOCK_USERS } from "../constants/mock-users";
import { COMPONENT_PLAYGROUND_PAGINATION } from "../constants/pagination";
import { AdminComponentPlaygroundSection } from "./AdminComponentPlaygroundSection";

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

/**
 * 관리자 페이지에서 사용하는 공통 컴포넌트의 표시 상태와
 * 사용자 상호작용을 직접 확인하기 위한 Playground다.
 */
export function AdminComponentPlaygroundClient() {
  const [currentPage, setCurrentPage] = useState(1);

  /**
   * 현재 페이지에 해당하는 Mock 사용자 목록이다.
   *
   * 이후 검색과 필터가 추가되면 필터링된 목록을 기준으로
   * 동일한 페이지네이션 계산을 적용할 수 있다.
   */
  const users = useMemo(() => {
    const startIndex =
      (currentPage - 1) * COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE;

    const endIndex = startIndex + COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE;

    return MOCK_USERS.slice(startIndex, endIndex);
  }, [currentPage]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Component Playground"
        description="관리자 페이지에서 사용하는 컴포넌트를 확인합니다."
      />

      <div className="space-y-4">
        {/*
         * Mock 사용자 목록은 각 실험 컴포넌트의 동작 결과를
         * 공통으로 확인하기 위한 데이터 표시 영역이다.
         *
         * 페이지네이션뿐 아니라 이후 검색과 필터 실험에서도
         * 동일한 목록을 사용한다.
         */}
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ID</th>

                <th className="px-4 py-3 text-left font-medium">이름</th>

                <th className="px-4 py-3 text-left font-medium">이메일</th>

                <th className="px-4 py-3 text-left font-medium">상태</th>

                <th className="px-4 py-3 text-left font-medium">역할</th>

                <th className="px-4 py-3 text-left font-medium">점수</th>

                <th className="px-4 py-3 text-left font-medium">가입일</th>
              </tr>
            </thead>

            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{user.id}</td>

                  <td className="px-4 py-3">{user.name}</td>

                  <td className="px-4 py-3">{user.email}</td>

                  <td className="px-4 py-3">
                    {USER_STATUS_LABELS[user.status]}
                  </td>

                  <td className="px-4 py-3">
                    {user.roles
                      .map((role) => USER_ROLE_LABELS[role])
                      .join(", ")}
                  </td>

                  <td className="px-4 py-3">{user.score}</td>

                  <td className="px-4 py-3">
                    {user.createdAt.toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <AdminComponentPlaygroundSection
          title="AdminPagination"
          description="Mock 사용자 목록을 이용해 페이지 이동과 페이지 그룹 전환 동작을 확인합니다."
        >
          <AdminPagination
            currentPage={currentPage}
            totalCount={MOCK_USERS.length}
            pageSize={COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE}
            pageCount={COMPONENT_PLAYGROUND_PAGINATION.PAGE_COUNT}
            onPageChange={setCurrentPage}
          />
        </AdminComponentPlaygroundSection>
      </div>
    </div>
  );
}
