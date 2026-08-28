"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * viewport 남은 높이 계산 hook의 입력값입니다.
 */
type UseViewportRemainingHeightOptions = {
  /** 이 값이 바뀌면 현재 ref 위치를 다시 측정합니다. */
  recalculationKey?: unknown;
};

/**
 * viewport 남은 높이 계산 hook의 반환값입니다.
 */
type UseViewportRemainingHeightResult<TElement extends HTMLElement> = {
  /** 남은 높이를 계산할 기준 DOM 요소 ref입니다. */
  containerRef: RefObject<TElement | null>;

  /** ref 요소의 top부터 viewport 하단까지 남은 높이입니다. */
  height: number | null;
};

/**
 * ref 요소의 시작 위치부터 viewport 하단까지 남은 높이를 계산합니다.
 *
 * @param options hook 설정
 * @param options.recalculationKey 변경 시 높이를 다시 계산할 기준 값
 * @returns 높이 계산 대상 ref와 계산된 남은 viewport 높이
 */
export function useViewportRemainingHeight<TElement extends HTMLElement>({
  recalculationKey,
}: UseViewportRemainingHeightOptions = {}): UseViewportRemainingHeightResult<TElement> {
  const containerRef = useRef<TElement | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const updateHeight = () => {
      const el = containerRef.current;

      if (!el) {
        return;
      }

      // 기존 구현과 동일하게 현재 요소의 top부터 viewport 하단까지를 높이로 사용합니다.
      const top = el.getBoundingClientRect().top;

      setHeight(Math.max(0, window.innerHeight - top));
    };

    updateHeight();

    window.addEventListener("resize", updateHeight);

    return () => {
      window.removeEventListener("resize", updateHeight);
    };
  }, [recalculationKey]);

  return { containerRef, height };
}
