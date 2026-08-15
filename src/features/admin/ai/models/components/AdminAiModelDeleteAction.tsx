"use client";

import { Button } from "@/components/ui/button";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";

/** 관리자 AI 모델 삭제 액션 속성입니다. */
type AdminAiModelDeleteActionProps = {
  /** 삭제 가능 여부 */
  canDelete: boolean;

  /** 삭제 차단 사유 목록 */
  deleteBlockedReasons: string[];

  /** 삭제 요청 진행 여부 */
  pending: boolean;

  /** 삭제 확인 시 실행할 함수 */
  onConfirm: () => void;
};

/**
 * AI 모델 삭제 확인 다이얼로그와 트리거 버튼을 렌더링합니다.
 *
 * @param props 삭제 액션 속성
 * @returns 관리자 AI 모델 삭제 액션
 */
export function AdminAiModelDeleteAction({
  canDelete,
  deleteBlockedReasons,
  onConfirm,
  pending,
}: AdminAiModelDeleteActionProps) {
  return (
    <div className="mr-auto">
      <AdminAlertDialog
        trigger={
          <Button type="button" variant="destructive">
            삭제
          </Button>
        }
        title={
          canDelete ? "AI 모델을 삭제할까요?" : "AI 모델을 삭제할 수 없습니다."
        }
        description={
          canDelete ? (
            "삭제한 모델은 복구할 수 없습니다."
          ) : (
            <ul className="space-y-1 text-left">
              {deleteBlockedReasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          )
        }
        confirmLabel={canDelete ? "삭제" : "확인"}
        confirmVariant={canDelete ? "destructive" : "default"}
        cancelLabel={canDelete ? "취소" : "닫기"}
        pending={pending}
        onConfirm={canDelete ? onConfirm : () => undefined}
      />
    </div>
  );
}
