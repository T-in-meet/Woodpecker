"use client";

import { useEffect } from "react";

/**
 * document 자체의 스크롤을 잠그고,
 * 전역 scrollbar-gutter로 예약된 여백을 해제합니다.
 *
 * Header 등 고정 영역과 별도로 레이아웃 내부에
 * 자체 스크롤 영역을 사용하는 화면에서 사용합니다.
 */
export function DocumentScrollLock() {
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    document.documentElement.classList.add("no-scrollbar-gutter");

    return () => {
      document.body.classList.remove("overflow-hidden");
      document.documentElement.classList.remove("no-scrollbar-gutter");
    };
  }, []);

  return null;
}
