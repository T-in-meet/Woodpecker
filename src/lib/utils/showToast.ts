/**
 * 명령형(Imperative) 토스트 유틸리티
 *
 * 사용법: 이벤트 핸들러 내에서 showToast(message, variant) 로 호출
 *
 * 설계:
 * - React 훅이 아님 (useState, useEffect 사용 안 함)
 * - 명령형: 이벤트 핸들러에서 직접 호출
 * - 필요할 때 Portal을 생성하고, Toast 컴포넌트를 렌더링한 뒤, 자동으로 마운트 해제함
 * - JSX 조건부 렌더링 없음 (클라이언트 상태 종속성 방지)
 *
 * 이유:
 * - Toast 컴포넌트는 단발성 디스플레이 요소임
 * - 조건부 렌더링을 사용하면 불필요한 상태 관리가 필요하게 됨
 * - 명령형 접근법을 통해 Toast를 컴포넌트 상태와 완벽히 분리함
 */

import React from "react";
import { createRoot } from "react-dom/client";

import { Toast } from "@/components/ui/toast";

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
  // 임시 컨테이너 생성
  const container = document.createElement("div");
  document.body.appendChild(container);

  // Root 생성 및 React.createElement를 사용하여 Toast 렌더링
  const root = createRoot(container);

  root.render(React.createElement(Toast, { variant, message }));

  // duration 이후 자동으로 마운트 해제
  setTimeout(() => {
    root.unmount();
    document.body.removeChild(container);
  }, duration);
}
