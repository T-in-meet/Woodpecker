/**
 * 명령형(Imperative) 토스트 유틸리티
 *
 * 사용법: 이벤트 핸들러 내에서 showToast(message, variant) 로 호출
 *
 * 설계:
 * - React 훅이 아님 (useState, useEffect 사용 안 함)
 * - 명령형: 이벤트 핸들러에서 직접 호출
 * - 전역 Toaster가 관리하는 sonner를 사용해 토스트 렌더링
 * - JSX 조건부 렌더링 없음 (클라이언트 상태 종속성 방지)
 *
 * 이유:
 * - Toast는 단발성 디스플레이 요소임
 * - 조건부 렌더링을 사용하면 불필요한 상태 관리가 필요하게 됨
 * - 명령형 접근법을 통해 Toast를 컴포넌트 상태와 완벽히 분리함
 * - sonner는 전역 Toaster에 의해 관리되므로 DOM 조작이 불필요함
 *
 * [변경 이유: createRoot / document.createElement 제거]
 * - sonner의 toast() 함수가 전역 Toaster에 의해 자동으로 관리됨
 * - 수동 DOM 조작과 마운트/언마운트 로직이 불필요함
 * - 여러 토스트가 자동으로 스택됨
 */

import { toast } from "sonner";

/**
 * 토스트 메시지를 명령형으로 표시한다
 *
 * @param message - 표시할 메시지
 * @param variant - "default" | "destructive" (선택사항, 기본값은 "default")
 * @param duration - 토스트를 표시할 밀리초(ms) 단위의 시간 (선택사항, 기본값은 3000)
 *
 * 예시:
 * try {
 *   await submitForm();
 * } catch {
 *   showToast("제출을 실패했습니다.", "destructive");
 * }
 */
export function showToast(
  message: string,
  variant: "default" | "destructive" = "default",
  duration = 3000,
): void {
  // [설계: sonner의 toast() 함수를 사용]
  // - variant를 sonner의 type 파라미터로 매핑: "destructive" → "error", "default" → "success"
  // - duration은 자동으로 처리됨
  if (variant === "destructive") {
    toast.error(message, { duration });
  } else {
    toast(message, { duration });
  }
}
