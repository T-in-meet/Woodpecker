"use client";

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

import { learningToolsContent } from "./content";
import { QuizPreview } from "./QuizPreview";

// 스크롤이 멎었다고 볼 때까지 기다리는 시간.
export const SETTLE_DELAY_MS = 150;
// 스크롤이 시작조차 못한 채 타이머가 발화했을 때 다시 기다려보는 횟수.
// 약 900ms까지 버티고, 그 뒤에는 어떤 이유로든 움직이지 않는 것으로 보고
// 목표를 풀어 activeIndex가 영영 실제 위치와 어긋난 채 남지 않게 한다.
export const MAX_SETTLE_RETRIES = 6;

/**
 * 관련 노트 목록(`RelatedNoteItem`)의 정적 재현.
 * 항목 테두리·아이콘·출처 배지(직접 연결 = blue, AI 추천 = violet)를
 * 실제 화면과 맞춘다. 실제 항목에 붙는 수정·삭제 버튼은 다이얼로그를
 * 끌고 오므로 랜딩에서는 뺐다.
 *
 * 실제 화면은 연결 이유를 팝오버 안에 숨기지만, 랜딩에서는 누를 수 없는
 * 컨트롤을 만들지 않으려고 이유를 항목 아래 한 줄로 펼쳐 둔다. 무엇이
 * 왜 묶였는지가 이 기능의 핵심이라 미리보기에서는 드러나는 편이 낫다.
 */
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
      <div className="ml-2 space-y-2 border-l border-orange-200 pl-4 dark:border-orange-900/40">
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

/**
 * 노트 챗봇 대화(`NoteChatUserMessage`·`NoteChatAssistantMessage`·
 * `NoteChatReferenceNotes`)의 정적 재현. 답변 말풍선은 실제로 마크다운을
 * 렌더하지만 여기서는 문단 하나면 충분해 ReactMarkdown을 끌어오지 않는다.
 */
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

/**
 * 학습 도구 카드를 가로로 넘기는 캐러셀.
 *
 * 3열 그리드로 두면 카드 높이가 가장 높은 것에 맞춰 늘어나는데, 카드마다
 * 담기는 내용의 양이 달라 짧은 카드 안쪽이 비어 보인다. 한 번에 한 장만
 * 보여주고 `items-start`로 각자 내용만큼만 차지하게 둔다.
 *
 * 한 번에 정확히 한 장만 보인다. 옆 카드를 걸쳐 보이게 하지 않는 대신 아래
 * 화살표와 점으로 더 있다는 걸 알린다. 스크롤러 자체를 max-w-2xl로 묶어 두는데,
 * 컨테이너 폭을 꽉 채우면 안쪽 미리보기가 가로로 늘어져 보이기 때문이다.
 *
 * CSS scroll-snap으로 만든다. 모바일 스와이프와 관성 스크롤을 브라우저가
 * 처리해주므로 섹션 하나 때문에 캐러셀 라이브러리를 들일 이유가 없다.
 * 자동 재생은 넣지 않는다 — 읽는 중에 넘어가면 방해가 된다.
 */
export function LearningToolsSection() {
  const tools = learningToolsContent.tools;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // 화살표·점이 누른 순간 목표로 잡은 장. smooth 스크롤이 끝나기 전에는 실제
  // 위치가 아직 이전 장 근처라, onScroll이 계산한 값으로 activeIndex를 되돌리면
  // 연속으로 눌러도 같은 장을 다시 목표로 잡게 된다. 목표를 여기 따로 들고
  // 도착할 때까지 onScroll의 판정을 미룬다.
  const pendingIndexRef = useRef<number | null>(null);
  // 스크롤이 멎었는지 재는 타이머. 도착 좌표만으로 판정하지 않는 이유는,
  // 사용자가 프로그램 스크롤 도중에 손으로 쓸어넘겨 애니메이션이 취소되면
  // 목표에 영영 닿지 않아 목표가 풀리지 않기 때문이다.
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 목표를 건 뒤 scroll 이벤트를 한 번이라도 봤는지. 손으로 쓸어넘겨 취소한
  // 경우와, 메인 스레드가 막혀 애니메이션이 아직 첫 프레임도 못 그린 경우를
  // 가른다. 전자는 그대로 회수하고 후자는 조금 더 기다린다.
  const pendingScrollSeenRef = useRef(false);
  const settleRetriesRef = useRef(0);
  // 카드 오프셋 캐시. 스크롤 이벤트마다 다시 재면 프레임마다 강제 리플로우가
  // 일어나 스와이프가 끊긴다. 값이 달라지는 건 카드 폭이 바뀔 때뿐이다.
  const cardOffsetsRef = useRef<number[] | null>(null);

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

  // 카드의 offsetLeft는 스크롤러가 아니라 위치 지정 조상(여기서는 body) 기준이라
  // 스크롤러의 왼쪽 여백만큼 통째로 밀린 값이 나온다. 그대로 scrollLeft와 비교하면
  // 이동 목표와 활성 인덱스가 함께 어긋나므로 스크롤러 기준 좌표를 직접 구한다.
  // 계산값이 현재 스크롤 위치와 무관하므로 한 번 재서 들고 있는다.
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

  // 카드 폭이 화면 폭에 따라 달라지므로 실제 자식의 위치로 현재 장을 판정한다.
  function getNearestIndex(scroller: HTMLElement) {
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

  // 목표한 장에 이미 도착했는지. 스냅 위치가 소수점으로 떨어질 수 있어
  // 1px 오차는 도착으로 본다.
  function hasReachedIndex(scroller: HTMLElement, index: number) {
    const offset = getCardOffsets(scroller)[index];
    if (offset === undefined) return true;

    return Math.abs(scroller.scrollLeft - offset) <= 1;
  }

  // 스크롤이 멎으면 목표를 풀고 실제 위치로 맞춘다. 목표한 장에 정상적으로
  // 도착한 경우와 도중에 취소된 경우를 한 곳에서 회수한다. 누른 자리에 이미
  // 있어 스크롤이 아예 일어나지 않는 경우도 있어 scrollToIndex에서도 건다.
  function scheduleSettle() {
    if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);

    settleTimerRef.current = setTimeout(() => {
      settleTimerRef.current = null;

      const scroller = scrollerRef.current;
      if (!scroller) {
        pendingIndexRef.current = null;
        return;
      }

      // 목표를 건 스크롤이 아직 시작도 못했고 목표 좌표에도 닿지 않았다면
      // 애니메이션이 첫 프레임을 못 그린 것이다(하이드레이션·이미지 디코딩으로
      // 메인 스레드가 막힌 저사양 기기). 여기서 목표를 풀면 activeIndex가
      // 직전 장으로 되돌아가 화살표를 두 번 눌러도 한 장만 넘어간다.
      // 손으로 쓸어넘겨 취소한 경우는 scroll 이벤트를 이미 봤으므로 걸리지 않고,
      // 끝내 움직이지 않는 경우를 위해 재시도 횟수를 제한한다.
      const pendingIndex = pendingIndexRef.current;
      if (
        pendingIndex !== null &&
        !pendingScrollSeenRef.current &&
        settleRetriesRef.current < MAX_SETTLE_RETRIES &&
        !hasReachedIndex(scroller, pendingIndex)
      ) {
        settleRetriesRef.current += 1;
        scheduleSettle();
        return;
      }

      pendingIndexRef.current = null;
      setActiveIndex(getNearestIndex(scroller));
    }, SETTLE_DELAY_MS);
  }

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // 목표가 잡혀 있는 동안 지나가는 중간 위치는 무시한다.
    if (pendingIndexRef.current !== null) {
      pendingScrollSeenRef.current = true;
      scheduleSettle();
      return;
    }

    setActiveIndex(getNearestIndex(scroller));
  }

  function scrollToIndex(index: number) {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    // 양 끝 화살표는 disabled로 막지 않으므로(포커스를 잃지 않게) 범위를 벗어난
    // 인덱스가 그대로 들어온다. 여기서 조용히 무시한다.
    const offset = getCardOffsets(scroller)[index];
    if (offset === undefined) return;

    // 화살표는 activeIndex에서 다음 장을 고르므로, 목표를 먼저 확정하고
    // activeIndex도 같이 옮겨야 애니메이션 도중에 다시 눌러도 한 장씩 넘어간다.
    pendingIndexRef.current = index;
    pendingScrollSeenRef.current = false;
    settleRetriesRef.current = 0;
    setActiveIndex(index);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    scroller.scrollTo({
      left: offset,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    // 누른 자리에 이미 있어 scroll 이벤트가 아예 없는 경우를 회수하려고 건다.
    scheduleSettle();
  }

  return (
    <section aria-labelledby="learning-tools-heading">
      <div className="mx-auto max-w-6xl px-6 py-12 md:py-20">
        {/* 앞 섹션의 "기록 → 알림 → 백지 테스트" 흐름과 이어주는 한 줄.
            제목보다 작게 두어 위계는 제목이 갖게 한다. */}
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
          ref={scrollerRef}
          onScroll={handleScroll}
          className="mx-auto mt-10 flex w-full max-w-2xl snap-x snap-mandatory items-start gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {tools.map((tool) => {
            const { icon: Icon, content } = previews[tool.id];
            return (
              <article
                key={tool.id}
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
          {/* disabled를 쓰면 마지막 장으로 넘어가는 순간 포커스를 쥔 버튼이
              비활성화돼 포커스가 body로 떨어진다. 표시만 aria-disabled로 하고
              범위를 벗어난 클릭은 scrollToIndex에서 무시한다. */}
          <button
            type="button"
            aria-label="이전 기능 보기"
            aria-disabled={activeIndex === 0}
            onClick={() => scrollToIndex(activeIndex - 1)}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>

          {/* 점은 8px로 보이되 누르는 영역은 24px을 확보한다. 버튼 자체를 8px로
              두면 모바일에서 겨냥하기 어렵다. 타깃끼리 겹치면 안 되므로 사이
              간격은 버튼 크기로만 벌어지게 두고 gap은 주지 않는다. */}
          <div className="flex items-center">
            {tools.map((tool, index) => (
              <button
                key={tool.id}
                type="button"
                aria-label={`${tool.label} 보기`}
                aria-current={index === activeIndex}
                onClick={() => scrollToIndex(index)}
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
            aria-disabled={activeIndex === tools.length - 1}
            onClick={() => scrollToIndex(activeIndex + 1)}
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
