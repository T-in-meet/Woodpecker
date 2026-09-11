"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

import { learningToolsContent } from "./content";
import { QuizPreview } from "./QuizPreview";

export const SETTLE_DELAY_MS = 150;

// 스크롤 시작 지연은 기다리되, 목표가 영구히 남지 않도록 재시도를 제한한다.
export const MAX_SETTLE_RETRIES = 6;

export const AUTOPLAY_INTERVAL_MS = 6000;

function RelatedNotesPreview() {
  const related = [
    {
      title: "조건 반사",
      origin: "직접 연결",
      reason: "중성 자극이 무조건 자극과 반복해 짝지어지며 학습된 반응",
    },
    {
      title: "자극 일반화",
      origin: "AI 추천",
      reason: "조건 자극과 비슷한 자극에도 같은 조건 반응이 나타나는 현상",
    },
    {
      title: "소거와 자발적 회복",
      origin: "AI 추천",
      reason: "조건 자극만 반복돼 약해진 반응이 휴지기 뒤 다시 나타나는 과정",
    },
  ];

  return (
    <div className="space-y-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <FileText className="size-4 shrink-0" aria-hidden />
        고전적 조건형성
      </p>
      <div className="ml-2 space-y-2 border-l border-brand-border pl-4">
        {related.map((item) => (
          <div key={item.title} className="rounded-lg border bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-foreground">
                <FileText className="size-4 shrink-0" aria-hidden />
                <span className="truncate">{item.title}</span>
              </span>
              <Badge
                variant="secondary"
                className={
                  item.origin === "직접 연결"
                    ? "shrink-0 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300"
                    : "shrink-0 bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-950 dark:text-violet-300"
                }
              >
                {item.origin}
              </Badge>
            </div>
            <p className="mt-1 pl-6 text-xs leading-5 text-muted-foreground">
              {item.reason}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-7 text-primary-foreground">
          클로저와 스코프는 어떤 관계야?
        </div>
      </div>

      <div className="w-full space-y-3 rounded-lg border bg-muted/30 px-4 py-4">
        <p className="text-sm leading-7">
          스코프는 변수를 찾을 수 있는 범위이고, 클로저는 함수가 선언된 위치의
          스코프를 기억하는 성질이에요. 그래서 바깥 함수가 끝난 뒤에도 안쪽
          함수가 그 변수에 접근할 수 있습니다.
        </p>
      </div>

      <div className="flex min-w-0 flex-wrap justify-end gap-2">
        {["클로저(Closure)란?", "렉시컬 스코프"].map((title) => (
          <span
            key={title}
            className="inline-flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md border bg-background px-3 text-xs font-medium"
          >
            <FileText className="size-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 truncate">{title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const previews = {
  quiz: { icon: Sparkles, content: <QuizPreview /> },
  "related-notes": { icon: GitBranch, content: <RelatedNotesPreview /> },
  chat: { icon: MessageCircle, content: <ChatPreview /> },
};

function wrapIndex(index: number, count: number) {
  return ((index % count) + count) % count;
}

// 복제본 추가 후 위치 보정은 첫 페인트 전에 끝내야 한다.
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * [마지막 복제, 원본 카드들, 첫 복제]로 순환하고, 정착 후 원본으로 순간 이동한다.
 * activeIndex는 원본 인덱스, slot은 복제본을 포함한 위치다.
 */
export function LearningToolsSection() {
  const tools = learningToolsContent.tools;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // SSR 첫 화면에 마지막 카드가 보이지 않도록 복제본은 마운트 후 추가한다.
  const [looped, setLooped] = useState(false);

  useEffect(() => {
    setLooped(true);
  }, []);

  const slotTools = looped
    ? [...tools.slice(-1), ...tools, ...tools.slice(0, 1)]
    : [...tools];

  const firstSlot = looped ? 1 : 0;

  const toSlot = (index: number) => index + firstSlot;
  const toRealIndex = (slot: number) =>
    wrapIndex(slot - firstSlot, tools.length);
  const isCloneSlot = (slot: number) =>
    looped && (slot === 0 || slot === tools.length + 1);

  // 연속 클릭 중에는 중간 스크롤 위치 대신 목표 인덱스를 유지한다.
  const pendingSlotRef = useRef<number | null>(null);

  // 복제본으로 이동 중 받은 요청은 원본 복귀 후 처리한다.
  const queuedSlotRef = useRef<number | null>(null);

  // 원본 복귀 스크롤을 사용자 입력으로 오인해 자동 넘김을 끄지 않도록 한다.
  const silentTargetRef = useRef<number | null>(null);

  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingScrollSeenRef = useRef(false);
  const settleRetriesRef = useRef(0);

  const cardOffsetsRef = useRef<number[] | null>(null);

  // 직접 조작한 뒤에는 자동 넘김을 재개하지 않는다.
  const [autoplayStopped, setAutoplayStopped] = useState(false);
  const [autoplayHovered, setAutoplayHovered] = useState(false);
  const [autoplayFocused, setAutoplayFocused] = useState(false);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!looped) return;

    const scroller = scrollerRef.current;
    if (!scroller) return;

    cardOffsetsRef.current = null;

    const offset = getCardOffsets(scroller)[1];
    if (offset === undefined) return;

    silentTargetRef.current = offset;
    scroller.scrollLeft = offset;
  }, [looped]);

  useEffect(() => {
    const invalidateOffsets = () => {
      cardOffsetsRef.current = null;
    };

    window.addEventListener("resize", invalidateOffsets);
    return () => {
      window.removeEventListener("resize", invalidateOffsets);
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = (matches: boolean) => setReducedMotion(matches);

    sync(media.matches);

    const handleChange = (event: MediaQueryListEvent) => sync(event.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const syncDocumentVisibility = () => setDocumentVisible(!document.hidden);

    syncDocumentVisibility();

    document.addEventListener("visibilitychange", syncDocumentVisibility);
    return () =>
      document.removeEventListener("visibilitychange", syncDocumentVisibility);
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new IntersectionObserver(
      ([entry]) =>
        setSectionVisible(
          Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.5),
        ),
      { threshold: 0.5 },
    );

    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // 타이머를 재설정하지 않고 최신 이동 함수를 참조한다.
  const goToNextRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (autoplayStopped || autoplayHovered || autoplayFocused || reducedMotion)
      return;
    if (!sectionVisible || !documentVisible) return;

    const timer = setTimeout(() => {
      goToNextRef.current();
    }, AUTOPLAY_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [
    activeIndex,
    autoplayFocused,
    autoplayHovered,
    autoplayStopped,
    documentVisible,
    reducedMotion,
    sectionVisible,
  ]);

  // 스크롤 중 반복 측정을 피하도록 스크롤러 기준 좌표를 캐시한다.
  function getCardOffsets(scroller: HTMLElement) {
    if (cardOffsetsRef.current !== null) return cardOffsetsRef.current;

    const scrollerLeft = scroller.getBoundingClientRect().left;
    const offsets = Array.from(scroller.children).map(
      (card) =>
        card.getBoundingClientRect().left - scrollerLeft + scroller.scrollLeft,
    );

    cardOffsetsRef.current = offsets;
    return offsets;
  }

  function getNearestSlot(scroller: HTMLElement) {
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    getCardOffsets(scroller).forEach((offset, index) => {
      const distance = Math.abs(offset - scroller.scrollLeft);
      if (distance >= nearestDistance) return;

      nearestDistance = distance;
      nearest = index;
    });

    return nearest;
  }

  // 소수점 스냅 좌표를 고려해 1px 오차를 허용한다.
  function hasReachedSlot(scroller: HTMLElement, slot: number) {
    const offset = getCardOffsets(scroller)[slot];
    if (offset === undefined) return true;

    return Math.abs(scroller.scrollLeft - offset) <= 1;
  }

  function jumpToSlot(scroller: HTMLElement, slot: number) {
    const offset = getCardOffsets(scroller)[slot];
    if (offset === undefined) return;

    silentTargetRef.current = offset;
    scroller.scrollLeft = offset;
  }

  // 사용자 입력으로 이동이 취소돼도 목표를 해제할 수 있도록 정지 시간을 잰다.
  function scheduleSettle() {
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);

    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;

      const scroller = scrollerRef.current;
      if (!scroller) {
        pendingSlotRef.current = null;
        return;
      }

      // 아직 시작하지 않은 이동을 취소된 이동으로 판단하지 않는다.
      const pendingSlot = pendingSlotRef.current;
      if (
        pendingSlot !== null &&
        !pendingScrollSeenRef.current &&
        settleRetriesRef.current < MAX_SETTLE_RETRIES &&
        !hasReachedSlot(scroller, pendingSlot)
      ) {
        settleRetriesRef.current += 1;
        scheduleSettle();
        return;
      }

      pendingSlotRef.current = null;

      const slot = getNearestSlot(scroller);
      const realIndex = toRealIndex(slot);
      setActiveIndex(realIndex);

      if (isCloneSlot(slot)) jumpToSlot(scroller, toSlot(realIndex));

      const queuedSlot = queuedSlotRef.current;
      queuedSlotRef.current = null;
      if (queuedSlot !== null) scrollToSlot(queuedSlot);
    }, SETTLE_DELAY_MS);
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const silentTarget = silentTargetRef.current;
    if (silentTarget !== null) {
      if (Math.abs(scroller.scrollLeft - silentTarget) <= 1) return;
      silentTargetRef.current = null;
    }

    if (pendingSlotRef.current !== null) {
      pendingScrollSeenRef.current = true;
      scheduleSettle();
      return;
    }

    setActiveIndex(toRealIndex(getNearestSlot(scroller)));

    scheduleSettle();
  }

  function scrollToSlot(slot: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const offset = getCardOffsets(scroller)[slot];
    if (offset === undefined) return;

    const pendingSlot = pendingSlotRef.current;
    if (pendingSlot !== null && isCloneSlot(pendingSlot)) {
      queuedSlotRef.current = slot;
      setActiveIndex(toRealIndex(slot));
      return;
    }

    // 연속 클릭이 다음 장을 가리키도록 실제 도착 전에 활성 인덱스를 갱신한다.
    pendingSlotRef.current = slot;
    pendingScrollSeenRef.current = false;
    settleRetriesRef.current = 0;
    silentTargetRef.current = null;
    setActiveIndex(toRealIndex(slot));

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    scroller.scrollTo({
      left: offset,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    // 이미 목표 위치라 scroll 이벤트가 발생하지 않는 경우도 회수한다.
    scheduleSettle();
  }

  function goToNext() {
    const nextSlot = toSlot(activeIndex) + 1;
    scrollToSlot(looped ? nextSlot : wrapIndex(nextSlot, tools.length));
  }

  goToNextRef.current = goToNext;

  function goToSlot(slot: number) {
    setAutoplayStopped(true);
    scrollToSlot(looped ? slot : wrapIndex(slot, tools.length));
  }

  function goToNextByUser() {
    setAutoplayStopped(true);
    goToNext();
  }

  function stopAutoplayByInput() {
    setAutoplayStopped(true);
    queuedSlotRef.current = null;
  }

  return (
    <section aria-labelledby="learning-tools-heading">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
        <p className="text-center text-sm font-medium text-muted-foreground">
          {learningToolsContent.connector}
        </p>
        <h2
          id="learning-tools-heading"
          className="mt-2 text-center text-3xl font-bold tracking-tight md:text-4xl"
        >
          {learningToolsContent.heading}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center leading-relaxed text-muted-foreground">
          {learningToolsContent.description}
        </p>

        <div
          ref={viewportRef}
          onMouseEnter={() => setAutoplayHovered(true)}
          onMouseLeave={() => setAutoplayHovered(false)}
          onFocusCapture={() => setAutoplayFocused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setAutoplayFocused(false);
            }
          }}
        >
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              touchStartRef.current = touch
                ? { x: touch.clientX, y: touch.clientY }
                : null;
            }}
            onTouchMove={(event) => {
              const start = touchStartRef.current;
              const touch = event.touches[0];
              if (!start || !touch) return;
              const dx = Math.abs(touch.clientX - start.x);
              const dy = Math.abs(touch.clientY - start.y);
              if (dx > 8 && dx > dy) stopAutoplayByInput();
            }}
            onTouchEnd={() => {
              touchStartRef.current = null;
            }}
            onTouchCancel={() => {
              touchStartRef.current = null;
            }}
            onWheel={(event) => {
              if (
                event.deltaX !== 0 ||
                (event.shiftKey && event.deltaY !== 0)
              ) {
                stopAutoplayByInput();
              }
            }}
            onKeyDown={(event) => {
              if (
                ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              ) {
                stopAutoplayByInput();
              }
            }}
            // relative는 sr-only 입력이 페이지 전체에 가로 넘침을 만드는 것을 막는다.
            className="relative mx-auto mt-10 flex w-full max-w-2xl snap-x snap-mandatory items-start gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {slotTools.map((tool, slot) => {
              const { icon: Icon, content } = previews[tool.id];
              return (
                <article
                  key={`${tool.id}-${slot}`}
                  aria-hidden={isCloneSlot(slot) || undefined}
                  className="flex w-full shrink-0 snap-start flex-col rounded-2xl border bg-card p-5"
                >
                  <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                    {tool.label}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight">
                    {tool.title}
                  </h3>
                  <p className="mb-4 mt-2 text-sm leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="mb-2 text-xs text-muted-foreground">
                      학습 예시
                    </p>
                    {content}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="이전 기능 보기"
              onClick={() => goToSlot(toSlot(activeIndex) - 1)}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>

            <div className="flex items-center">
              {tools.map((tool, index) => (
                <button
                  key={tool.id}
                  type="button"
                  aria-label={`${tool.label} 보기`}
                  aria-current={index === activeIndex}
                  onClick={() => goToSlot(toSlot(index))}
                  className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full transition-colors",
                      index === activeIndex ? "bg-foreground" : "bg-border",
                    )}
                  />
                </button>
              ))}
            </div>

            <button
              type="button"
              aria-label="다음 기능 보기"
              onClick={goToNextByUser}
              className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
