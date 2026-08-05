"use client";

import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useUpdateUserRole } from "../hooks/use-update-user-role";
import type { UserRole } from "../types/user-list";

type AdminUserRoleSelectProps = {
  /** 역할을 변경할 사용자 ID */
  userId: string;

  /** 현재 사용자 역할 */
  role: UserRole;

  /** 역할 변경을 허용하지 않을지 여부 */
  disabled?: boolean | undefined;
};

/**
 * 관리자 사용자 목록에서 사용자의 역할을 직접 변경하는 Select입니다.
 *
 * 현재 로그인한 관리자의 역할은 변경할 수 없으며,
 * 역할 변경 요청 중에는 중복 요청을 방지하기 위해 Select를 비활성화합니다.
 */
export function AdminUserRoleSelect({
  userId,
  role,
  disabled = false,
}: AdminUserRoleSelectProps) {
  const updateUserRoleMutation = useUpdateUserRole();

  /**
   * 현재 역할과 다른 역할을 선택한 경우 사용자 역할을 변경합니다.
   *
   * @param value 새로 선택한 역할
   */
  async function handleValueChange(value: string) {
    const nextRole = value as UserRole;

    if (nextRole === role) {
      return;
    }

    try {
      const result = await updateUserRoleMutation.mutateAsync({
        userId,
        role: nextRole,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success("사용자 역할을 변경했습니다.");
    } catch {
      toast.error("사용자 역할 변경 중 오류가 발생했습니다.");
    }
  }

  return (
    <Select
      value={role}
      disabled={disabled || updateUserRoleMutation.isPending}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-28" aria-label="사용자 역할 변경">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="USER">사용자</SelectItem>
        <SelectItem value="ADMIN">관리자</SelectItem>
      </SelectContent>
    </Select>
  );
}
