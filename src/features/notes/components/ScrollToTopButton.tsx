"use client";

import { ArrowUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/** 이 높이 이상 내려갔을 때만 버튼을 노출한다. 짧은 노트에서는 필요 없는 UI다. */
const SHOW_THRESHOLD_PX = 400;

/**
 * 노트가 길어졌을 때 맨 위로 돌아가는 모바일 전용 버튼.
 *
 * 데스크톱은 휠·Home 키로 충분해서 `md:hidden`으로 감춘다.
 * 세로 위치를 `bottom-20`으로 올린 건 toast(`fixed bottom-4 right-4`)와 겹치지 않게 하기 위해서다.
 */
export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    let isScheduled = false;

    const update = () => {
      isScheduled = false;
      setIsVisible(window.scrollY > SHOW_THRESHOLD_PX);
    };

    const handleScroll = () => {
      // 스크롤 이벤트마다 setState를 부르지 않도록 프레임당 한 번으로 묶는다.
      // 예약 여부를 프레임 id가 아닌 별도 플래그로 보는 건, rAF가 동기로 실행되는
      // 환경에서 콜백이 끝난 뒤에 id가 대입돼 영영 예약 상태로 남는 걸 막기 위해서다.
      if (isScheduled) return;
      isScheduled = true;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  const handleClick = useCallback(() => {
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label="맨 위로 이동"
      aria-hidden={!isVisible}
      tabIndex={isVisible ? undefined : -1}
      onClick={handleClick}
      className={`fixed right-4 bottom-20 z-40 rounded-full shadow-md transition-opacity md:hidden ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <ArrowUp aria-hidden="true" />
    </Button>
  );
}
