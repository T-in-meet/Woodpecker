import { Inbox, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

interface AdminListStateProps {
  /** 상태를 시각적으로 표현하는 아이콘 */
  icon: ReactNode;

  /** 상태를 설명하는 제목 */
  title: string;

  /** 제목 아래에 표시할 추가 설명 */
  description?: string | undefined;

  /** 다시 시도, 필터 초기화 등의 액션 영역 */
  action?: ReactNode | undefined;

  /** 접근성에 사용할 상태 영역 역할 */
  role?: "status" | "alert" | undefined;

  /** 상태 컨테이너에 추가할 클래스 */
  className?: string | undefined;
}

/**
 * 관리자 목록에서 데이터가 없거나 오류가 발생한 경우 표시하는
 * 공통 상태 컴포넌트입니다.
 */
export function AdminListState({
  icon,
  title,
  description,
  action,
  role = "status",
  className,
}: AdminListStateProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex min-h-64 flex-col items-center justify-center px-4 py-12 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground mb-4 [&>svg]:size-10">{icon}</div>

      <h3 className="text-base font-semibold">{title}</h3>

      {description ? (
        <p className="text-muted-foreground mt-2 max-w-md text-sm">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

interface AdminListEmptyProps {
  /** 빈 상태 제목 */
  title?: string | undefined;

  /** 빈 상태에 대한 추가 설명 */
  description?: string | undefined;

  /** 필터 초기화, 생성 버튼 등의 액션 영역 */
  action?: ReactNode | undefined;

  /** 기본 아이콘 대신 표시할 아이콘 */
  icon?: ReactNode | undefined;

  /** 상태 컨테이너에 추가할 클래스 */
  className?: string | undefined;
}

/**
 * 관리자 목록의 조회 결과가 없을 때 표시합니다.
 */
export function AdminListEmpty({
  title = "조회된 항목이 없습니다.",
  description,
  action,
  icon = <Inbox aria-hidden="true" />,
  className,
}: AdminListEmptyProps) {
  return (
    <AdminListState
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

interface AdminListErrorProps {
  /** 오류 상태 제목 */
  title?: string | undefined;

  /** 오류 원인이나 사용자 안내 문구 */
  description?: string | undefined;

  /** 다시 시도 버튼 등의 액션 영역 */
  action?: ReactNode | undefined;

  /** 기본 아이콘 대신 표시할 아이콘 */
  icon?: ReactNode | undefined;

  /** 상태 컨테이너에 추가할 클래스 */
  className?: string | undefined;
}
/**
 * 관리자 목록을 불러오는 과정에서 오류가 발생했을 때 표시합니다.
 */
export function AdminListError({
  title = "목록을 불러오지 못했습니다.",
  description = "잠시 후 다시 시도해 주세요.",
  action,
  icon = <TriangleAlert aria-hidden="true" />,
  className,
}: AdminListErrorProps) {
  return (
    <AdminListState
      role="alert"
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
