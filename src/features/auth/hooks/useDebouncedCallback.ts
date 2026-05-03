import { useCallback, useEffect, useRef } from "react";

/**
 * debounce된 callback 실행을 관리하는 hook.
 *
 * @description
 * - schedule 호출 시 callback을 delay 이후 실행한다.
 * - delay 내에 다시 호출되면 이전 예약을 취소하고 새로 예약한다.
 *
 * @returns
 * - schedule: debounce 실행 예약
 * - cancel: 예약된 callback 즉시 취소
 *
 * @usage
 * - 입력 변화에 따른 validation, 검색 요청 등 과도한 호출을 줄이기 위한 용도
 * - submit 직전에는 cancel을 호출해 예약된 실행을 정리해야 한다
 *
 * @lifecycle
 * - 컴포넌트 unmount 시 자동으로 timeout을 정리한다
 */
export function useDebouncedCallback(callback: () => void, delay: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const schedule = useCallback(() => {
    cancel();
    timeoutRef.current = setTimeout(callback, delay);
  }, [callback, cancel, delay]);

  useEffect(() => cancel, [cancel]);

  return { schedule, cancel };
}
