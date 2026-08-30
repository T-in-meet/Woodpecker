"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type NavigationGuardAlertDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 앱 내부 페이지 이동을 계속할지 확인하는 공통 AlertDialog입니다.
 *
 * 이동 감지나 보류 상태는 직접 관리하지 않으며,
 * useInternalNavigationGuard 등 외부 로직에서 전달받은 상태와 액션만 사용합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.open Dialog 표시 여부
 * @param props.title 경고 제목
 * @param props.description 경고 설명
 * @param props.confirmLabel 이동 확인 버튼 문구
 * @param props.cancelLabel 이동 취소 버튼 문구
 * @param props.onConfirm 보류된 이동을 계속하는 액션
 * @param props.onCancel 보류된 이동을 취소하는 액션
 */
export function NavigationGuardAlertDialog({
  open,
  title,
  description,
  confirmLabel = "이동",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: NavigationGuardAlertDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>

          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
