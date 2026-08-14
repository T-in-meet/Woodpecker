import { FileQuestion, TriangleAlert } from "lucide-react";
import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type AdminDetailLoadingProps = {
  /** 로딩 상태 제목 */
  title?: string | undefined;

  /** 로딩 상태에 대한 추가 설명 */
  description?: string | undefined;

  /** 상태 컨테이너에 추가할 클래스 */
  className?: string | undefined;
};

/**
 * 관리자 상세 데이터를 불러오는 동안 표시합니다.
 */
export function AdminDetailLoading({
  title = "상세 정보를 불러오는 중입니다.",
  description,
  className,
}: AdminDetailLoadingProps) {
  return (
    <AdminDetailState
      icon={<LoaderCircle aria-hidden="true" className="size-8 animate-spin" />}
      title={title}
      description={description}
      className={className}
    />
  );
}

type AdminDetailStateProps = {
  /** 상태를 시각적으로 표현하는 아이콘 */
  icon: ReactNode;

  /** 상태를 설명하는 제목 */
  title: string;

  /** 제목 아래에 표시할 추가 설명 */
  description?: string | undefined;

  /** 다시 시도, 목록 이동 등의 액션 영역 */
  action?: ReactNode | undefined;

  /** 접근성에 사용할 상태 영역 역할 */
  role?: "status" | "alert" | undefined;

  /** 상태 컨테이너에 추가할 클래스 */
  className?: string | undefined;
};

/**
 * 관리자 상세 화면에서 데이터가 없거나 오류가 발생한 경우 표시하는
 * 공통 상태 컴포넌트입니다.
 */
export function AdminDetailState({
  icon,
  title,
  description,
  action,
  role = "status",
  className,
}: AdminDetailStateProps) {
  return (
    <div
      role={role}
      className={cn(
        "flex min-h-60 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
    >
      <div className="text-muted-foreground">{icon}</div>

      <div className="space-y-1">
        <p className="font-medium">{title}</p>

        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

type AdminDetailNotFoundProps = {
  /** 상세 데이터가 존재하지 않을 때 표시할 제목 */
  title?: string | undefined;

  /** 데이터가 존재하지 않는 이유나 사용자 안내 문구 */
  description?: string | undefined;

  /** 목록 이동 등의 액션 영역 */
  action?: ReactNode | undefined;

  /** 기본 아이콘 대신 표시할 아이콘 */
  icon?: ReactNode | undefined;

  /** 상태 컨테이너에 추가할 클래스 */
  className?: string | undefined;
};

/**
 * 관리자 상세 조회 결과가 존재하지 않을 때 표시합니다.
 */
export function AdminDetailNotFound({
  title = "요청한 항목을 찾을 수 없습니다.",
  description = "삭제되었거나 존재하지 않는 항목입니다.",
  action,
  icon = <FileQuestion aria-hidden="true" className="size-8" />,
  className,
}: AdminDetailNotFoundProps) {
  return (
    <AdminDetailState
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}

type AdminDetailErrorProps = {
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
};

/**
 * 관리자 상세 데이터를 불러오는 과정에서 오류가 발생했을 때 표시합니다.
 */
export function AdminDetailError({
  title = "상세 정보를 불러오지 못했습니다.",
  description = "잠시 후 다시 시도해 주세요.",
  action,
  icon = <TriangleAlert aria-hidden="true" className="size-8" />,
  className,
}: AdminDetailErrorProps) {
  return (
    <AdminDetailState
      role="alert"
      icon={icon}
      title={title}
      description={description}
      action={action}
      className={className}
    />
  );
}
