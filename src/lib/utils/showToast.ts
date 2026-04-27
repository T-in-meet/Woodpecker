import { toast } from "sonner";

/**
 * 명령형(Imperative) 토스트 유틸리티
 *
 * 사용법:
 * showToast(message, { variant, duration, dedupeKey })
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
 * - 명령형 접근법을 통해 Toast를 컴포넌트 상태와 완전히 분리함
 * - sonner는 전역 Toaster에 의해 관리되므로 DOM 조작이 불필요함
 *
 * 옵션 설계:
 * - variant, duration, dedupeKey를 하나의 객체로 관리
 * - dedupeKey를 통해 동일 의미의 toast 중복 표시를 방지
 * - dedupeKey는 Sonner의 id로 매핑됨
 *
 * [변경 이유: createRoot / document.createElement 제거]
 * - sonner의 toast() 함수가 전역 Toaster에 의해 자동으로 관리됨
 * - 수동 DOM 조작과 마운트/언마운트 로직이 불필요함
 * - 여러 토스트가 자동으로 스택됨
 */

type ToastVariant = "default" | "destructive";

type ShowToastOptions = {
  variant?: ToastVariant;
  duration?: number;
  dedupeKey?: string;
};

/**
 * 토스트 메시지를 명령형으로 표시한다
 *
 * @param message - 표시할 메시지
 * @param options - 토스트 옵션
 *   - variant: "default" | "destructive" (기본값: "default")
 *   - duration: 표시 시간(ms) (기본값: 3000)
 *   - dedupeKey: 동일 의미 toast 중복 방지 키
 *
 * 예시:
 * showToast("저장되었습니다.");
 *
 * showToast("요청에 실패했습니다.", {
 *   variant: "destructive",
 * });
 *
 * showToast("잠시 후 다시 시도해주세요.", {
 *   variant: "destructive",
 *   dedupeKey: "auth-rate-limit",
 * });
 */
export function showToast(
  message: string,
  options: ShowToastOptions = {},
): void {
  const { variant = "default", duration = 3000, dedupeKey } = options;

  const toastOptions = {
    duration,
    ...(dedupeKey ? { id: dedupeKey } : {}),
  };

  if (variant === "destructive") {
    toast.error(message, toastOptions);
  } else {
    toast(message, toastOptions);
  }
}
