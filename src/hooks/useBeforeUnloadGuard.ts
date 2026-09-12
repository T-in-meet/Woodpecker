"use client";

import { useEffect } from "react";

type UseBeforeUnloadGuardParams = {
  enabled: boolean;
};

/**
 * 새로고침, 탭 닫기 등 브라우저 수준의 페이지 이탈을 경고합니다.
 *
 * beforeunload에서는 커스텀 AlertDialog를 사용할 수 없으므로
 * 브라우저가 제공하는 기본 이탈 확인 UI를 사용합니다.
 *
 * @param params Hook 입력값
 * @param params.enabled 브라우저 이탈 경고 활성화 여부
 */
export function useBeforeUnloadGuard({ enabled }: UseBeforeUnloadGuardParams) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled]);
}
