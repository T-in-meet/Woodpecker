import { useMutation, useQueryClient } from "@tanstack/react-query";

import { updateUserRole } from "../actions";
import { ADMIN_USERS_QUERY_KEY } from "../constants/query-keys";
import type { UserRole } from "../types/user-list";

type UpdateUserRoleVariables = {
  /** 역할을 변경할 profiles.id */
  userId: string;

  /** 새로 적용할 사용자 역할 */
  role: UserRole;
};

/**
 * 관리자 사용자 역할 변경 Mutation 훅입니다.
 *
 * 역할 변경에 성공하면 현재 화면뿐 아니라 검색, 필터, 정렬,
 * 페이지 조건별로 캐시된 모든 관리자 사용자 목록을 무효화합니다.
 */
export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: UpdateUserRoleVariables) =>
      updateUserRole(userId, role),

    onSuccess: async (result) => {
      if (!result.ok) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: ADMIN_USERS_QUERY_KEY.all,
      });
    },
  });
}
