"use client";

import type { VariantProps } from "class-variance-authority";
import type { ReactElement, ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

/**
 * 관리자 확인 대화상자가 공통으로 사용하는 속성입니다.
 */
interface AdminAlertDialogBaseProps {
  /** AlertDialog를 여는 Trigger 요소 */
  trigger: ReactElement;

  /** 대화상자 제목 */
  title: string;

  /** 작업에 대한 보조 설명 */
  description?: ReactNode;

  /** 확인 버튼에 표시할 문구 */
  confirmLabel?: string;

  /** 취소 버튼에 표시할 문구 */
  cancelLabel?: string;

  /** 확인 버튼의 variant (지정 시 destructive보다 우선 적용됩니다) */
  confirmVariant?: VariantProps<typeof buttonVariants>["variant"];

  /** 취소 버튼의 variant (기본값: outline) */
  cancelVariant?: VariantProps<typeof buttonVariants>["variant"];

  /** true면 확인 버튼을 좌측, 취소 버튼을 우측에 렌더링합니다. */
  reverseActions?: boolean;

  /** 작업 처리 중인지 여부 */
  pending?: boolean;

  /** 확인 버튼을 선택했을 때 호출됩니다. */
  onConfirm: () => void;
}

interface AdminAlertDialogUncontrolledProps extends AdminAlertDialogBaseProps {
  open?: never;
  onOpenChange?: never;
}

interface AdminAlertDialogControlledProps extends AdminAlertDialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AdminAlertDialogProps =
  | AdminAlertDialogUncontrolledProps
  | AdminAlertDialogControlledProps;

/**
 * 관리자 페이지에서 삭제 및 상태 변경 확인에 사용하는 공통 대화상자입니다.
 *
 * shadcn/ui의 AlertDialog를 기반으로 하며,
 * 위험 작업 스타일과 처리 중 상태를 공통으로 제공합니다.
 */
export function AdminAlertDialog({
  trigger,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  confirmVariant,
  cancelVariant,
  reverseActions = false,
  pending = false,
  open,
  onOpenChange,
  onConfirm,
}: AdminAlertDialogProps) {
  const cancelButton = (
    <AlertDialogCancel key="cancel" variant={cancelVariant} disabled={pending}>
      {cancelLabel}
    </AlertDialogCancel>
  );

  const confirmButton = (
    <AlertDialogAction
      key="confirm"
      variant={confirmVariant ?? "default"}
      disabled={pending}
      onClick={onConfirm}
    >
      {pending ? "처리 중..." : confirmLabel}
    </AlertDialogAction>
  );

  return (
    <AlertDialog
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange !== undefined ? { onOpenChange } : {})}
    >
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>

          {description !== undefined ? (
            <AlertDialogDescription asChild>
              <div>{description}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <AlertDialogFooter className="sm:justify-between">
          {reverseActions
            ? [confirmButton, cancelButton]
            : [cancelButton, confirmButton]}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
