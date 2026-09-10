import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { learningToolsContent } from "@/features/landing/content";
import {
  AUTOPLAY_INTERVAL_MS,
  LearningToolsSection,
  MAX_SETTLE_RETRIES,
  SETTLE_DELAY_MS,
} from "@/features/landing/LearningToolsSection";

// jsdom에는 레이아웃이 없어 카드 위치·scrollLeft·scrollTo가 전부 0이거나 없다.
// 캐러셀은 실제 자식 좌표로 현재 장을 판정하므로, 폭이 CARD_WIDTH인 카드가
// 나란히 놓인 스크롤러를 흉내 내 좌표 계산이 돌아가게 만든다.
const CARD_WIDTH = 600;

const tools = learningToolsContent.tools;

type IntersectionEntryStub = { isIntersecting: boolean };

// 자동 넘김은 섹션이 화면에 보일 때만 돈다. jsdom에는 IntersectionObserver가
// 없으므로 콜백을 붙잡아 두고 테스트가 직접 발화시킨다. 발화시키지 않으면
// 화면 밖으로 남아 자동 넘김이 꺼진 상태가 되므로, 자동 넘김과 무관한
// 테스트는 손댈 필요가 없다.
let fireIntersection: ((entries: IntersectionEntryStub[]) => void) | null =
  null;
let prefersReducedMotion = false;

type Carousel = {
  scrollTo: ReturnType<typeof vi.fn>;
  unmount: () => void;
  // 사용자가 손으로 쓸어넘긴 상황. 프로그램 스크롤과 달리 목표를 걸지 않는다.
  swipeTo: (left: number) => void;
  setCardWidth: (width: number) => void;
  activeDotIndex: () => number;
  clickNext: () => void;
  clickPrev: () => void;
  settle: () => void;
  // 섹션이 화면에 들어왔다고 알린다. 자동 넘김은 이 뒤에야 돈다.
  enterViewport: () => void;
  hover: () => void;
  unhover: () => void;
  // 탭을 백그라운드로 보냈다가 되돌린다.
  hide: () => void;
  show: () => void;
  advance: (ms?: number) => void;
};

// jsdom의 document.hidden은 항상 false다. 값을 갈아끼우고 이벤트를 쏴서
// 탭 전환을 흉내 낸다.
function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });

  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function makeRect(left: number, width: number) {
  return {
    x: left,
    y: 0,
    left,
    right: left + width,
    top: 0,
    bottom: 0,
    width,
    height: 0,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

/**
 * @param animateScroll `false`면 scrollTo가 호출만 기록하고 실제로 움직이지
 *   않는다. 메인 스레드가 막혀 smooth 스크롤이 첫 프레임도 못 그린 상황이다.
 */
function mountCarousel({ animateScroll = true } = {}): Carousel {
  const { container, unmount } = render(<LearningToolsSection />);

  const scroller = container.querySelector("article")?.parentElement;
  if (!scroller) throw new Error("스크롤러를 찾지 못했다");

  let scrollLeft = 0;
  let cardWidth = CARD_WIDTH;

  Object.defineProperty(scroller, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });

  scroller.getBoundingClientRect = () => makeRect(0, cardWidth);
  Array.from(scroller.children).forEach((card, index) => {
    card.getBoundingClientRect = () =>
      makeRect(index * cardWidth - scrollLeft, cardWidth);
  });

  const scrollTo = vi.fn((options: ScrollToOptions) => {
    if (!animateScroll) return;

    scrollLeft = options.left ?? 0;
    scroller.dispatchEvent(new Event("scroll"));
  });
  scroller.scrollTo = scrollTo as unknown as HTMLElement["scrollTo"];

  const viewport = scroller.parentElement;
  if (!viewport) throw new Error("뷰포트를 찾지 못했다");

  const clickButton = (name: string) => {
    fireEvent.click(screen.getByRole("button", { name }));
  };

  return {
    scrollTo,
    unmount,
    swipeTo: (left: number) => {
      act(() => {
        scrollLeft = left;
        scroller.dispatchEvent(new Event("scroll"));
      });
    },
    setCardWidth: (width: number) => {
      cardWidth = width;
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });
    },
    activeDotIndex: () =>
      tools.findIndex(
        (tool) =>
          screen
            .getByRole("button", { name: `${tool.label} 보기` })
            .getAttribute("aria-current") === "true",
      ),
    clickNext: () => clickButton("다음 기능 보기"),
    clickPrev: () => clickButton("이전 기능 보기"),
    settle: () => {
      act(() => {
        vi.advanceTimersByTime(SETTLE_DELAY_MS);
      });
    },
    enterViewport: () => {
      act(() => {
        fireIntersection?.([{ isIntersecting: true }]);
      });
    },
    // React는 onMouseEnter/onMouseLeave를 mouseover/mouseout 위임으로 만든다.
    // mouseenter를 직접 쏘면 핸들러가 걸리지 않는다.
    hover: () => {
      act(() => {
        fireEvent.mouseOver(viewport);
      });
    },
    unhover: () => {
      act(() => {
        fireEvent.mouseOut(viewport, { relatedTarget: document.body });
      });
    },
    hide: () => setDocumentHidden(true),
    show: () => setDocumentHidden(false),
    advance: (ms = AUTOPLAY_INTERVAL_MS) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    },
  };
}

describe("LearningToolsSection 캐러셀", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fireIntersection = null;
    prefersReducedMotion = false;

    class IntersectionObserverStub {
      readonly root = null;
      readonly rootMargin = "";
      readonly thresholds: ReadonlyArray<number> = [];

      constructor(callback: IntersectionObserverCallback) {
        fireIntersection = (entries) => {
          callback(
            entries as unknown as IntersectionObserverEntry[],
            this as unknown as IntersectionObserver,
          );
        };
      }

      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }

    globalThis.IntersectionObserver =
      IntersectionObserverStub as unknown as typeof IntersectionObserver;

    // scrollToIndex와 자동 넘김이 prefers-reduced-motion을 본다. jsdom 구현은
    // 환경마다 달라서 테스트가 직접 값을 정한다. 기본값은 smooth 경로다.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: prefersReducedMotion,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    setDocumentHidden(false);
  });

  it("화살표를 연속으로 누르면 한 장씩 이어서 넘어간다", () => {
    const carousel = mountCarousel();

    // 스크롤이 멎기 전에 다시 누르는 상황. 중간 위치로 activeIndex를 되돌리면
    // 두 번째 클릭이 같은 장을 다시 목표로 잡아 한 장만 넘어간다.
    carousel.clickNext();
    carousel.clickNext();

    expect(
      carousel.scrollTo.mock.calls.map(([options]) => options.left),
    ).toEqual([CARD_WIDTH, CARD_WIDTH * 2]);

    carousel.settle();
    expect(carousel.activeDotIndex()).toBe(2);
  });

  it("마지막 장에서 다음을 누르면 첫 장으로 돌아온다", () => {
    const carousel = mountCarousel();

    carousel.clickNext();
    carousel.clickNext();
    carousel.settle();
    carousel.scrollTo.mockClear();

    carousel.clickNext();
    carousel.settle();

    expect(carousel.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 0 }),
    );
    expect(carousel.activeDotIndex()).toBe(0);
  });

  it("첫 장에서 이전을 누르면 마지막 장으로 간다", () => {
    const carousel = mountCarousel();

    carousel.clickPrev();
    carousel.settle();

    expect(carousel.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: CARD_WIDTH * (tools.length - 1) }),
    );
    expect(carousel.activeDotIndex()).toBe(tools.length - 1);
  });

  it("양 끝에서도 화살표를 비활성화하지 않는다", () => {
    mountCarousel();

    // 순환하므로 막을 이유가 없다. 끝에서 비활성화하면 포커스를 쥔 버튼이
    // 사라져 포커스가 body로 떨어진다.
    expect(
      screen.getByRole("button", { name: "이전 기능 보기" }),
    ).not.toHaveAttribute("aria-disabled");
    expect(
      screen.getByRole("button", { name: "다음 기능 보기" }),
    ).not.toHaveAttribute("aria-disabled");
  });

  it("프로그램 스크롤 도중 사용자가 쓸어넘기면 목표를 버리고 실제 위치를 따른다", () => {
    const carousel = mountCarousel();

    carousel.clickNext();
    carousel.scrollTo.mockClear();

    // smooth 스크롤이 끝나기 전에 손으로 첫 장까지 되돌린 상황.
    carousel.swipeTo(0);
    carousel.settle();

    expect(carousel.activeDotIndex()).toBe(0);
    // 버린 목표로 다시 끌고 가지 않는다.
    expect(carousel.scrollTo).not.toHaveBeenCalled();
  });

  it("사용자 스크롤만으로 활성 장이 따라간다", () => {
    const carousel = mountCarousel();

    carousel.swipeTo(CARD_WIDTH * 2);

    expect(carousel.activeDotIndex()).toBe(2);
    expect(carousel.scrollTo).not.toHaveBeenCalled();
  });

  it("스크롤이 첫 프레임을 못 그려도 활성 장을 되돌리지 않고 기다린다", () => {
    const carousel = mountCarousel({ animateScroll: false });

    carousel.clickNext();
    expect(carousel.scrollTo).toHaveBeenCalledTimes(1);

    // 여기서 목표를 풀면 activeIndex가 첫 장으로 되돌아가 두 번 눌러도
    // 한 장만 넘어가는 회귀가 난다.
    carousel.settle();
    expect(carousel.activeDotIndex()).toBe(1);

    // 끝내 움직이지 않으면 재시도 한도에서 실제 위치로 회수한다.
    act(() => {
      vi.advanceTimersByTime(SETTLE_DELAY_MS * (MAX_SETTLE_RETRIES + 1));
    });
    expect(carousel.activeDotIndex()).toBe(0);
  });

  it("카드 폭이 바뀌면 다시 재서 이동한다", () => {
    const carousel = mountCarousel();

    carousel.clickNext();
    carousel.settle();

    carousel.setCardWidth(1000);
    carousel.scrollTo.mockClear();
    carousel.clickNext();

    expect(carousel.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: 2000 }),
    );
  });

  it("화면에 들어오면 일정 시간마다 다음 장으로 넘어간다", () => {
    const carousel = mountCarousel();

    carousel.enterViewport();
    carousel.advance();

    expect(carousel.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ left: CARD_WIDTH }),
    );
    expect(carousel.activeDotIndex()).toBe(1);
  });

  it("마지막 장 다음에는 첫 장으로 돌아온다", () => {
    const carousel = mountCarousel();

    carousel.enterViewport();
    // 0 -> 1 -> 2 -> 0. 마지막에서 멈추지 않고 순환한다.
    carousel.advance();
    carousel.advance();
    carousel.advance();

    expect(
      carousel.scrollTo.mock.calls.map(([options]) => options.left),
    ).toEqual([CARD_WIDTH, CARD_WIDTH * 2, 0]);
    expect(carousel.activeDotIndex()).toBe(0);
  });

  it("화면 밖이면 자동으로 넘어가지 않는다", () => {
    const carousel = mountCarousel();

    // enterViewport를 부르지 않은 상태 = 섹션이 아직 화면 밖이다.
    carousel.advance(AUTOPLAY_INTERVAL_MS * 3);

    expect(carousel.scrollTo).not.toHaveBeenCalled();
    expect(carousel.activeDotIndex()).toBe(0);
  });

  it("포인터가 올라가 있는 동안에는 넘어가지 않는다", () => {
    const carousel = mountCarousel();

    carousel.enterViewport();
    carousel.hover();
    carousel.advance(AUTOPLAY_INTERVAL_MS * 2);

    expect(carousel.scrollTo).not.toHaveBeenCalled();

    // 포인터가 빠지면 다시 돈다.
    carousel.unhover();
    carousel.advance();

    expect(carousel.activeDotIndex()).toBe(1);
  });

  it("사용자가 직접 넘긴 뒤에는 자동으로 넘어가지 않는다", () => {
    const carousel = mountCarousel();

    carousel.enterViewport();
    carousel.clickNext();
    carousel.settle();
    carousel.scrollTo.mockClear();

    carousel.advance(AUTOPLAY_INTERVAL_MS * 3);

    expect(carousel.scrollTo).not.toHaveBeenCalled();
    expect(carousel.activeDotIndex()).toBe(1);
  });

  it("쓸어넘긴 뒤에도 자동으로 넘어가지 않는다", () => {
    const carousel = mountCarousel();

    carousel.enterViewport();
    carousel.swipeTo(CARD_WIDTH);
    carousel.scrollTo.mockClear();

    carousel.advance(AUTOPLAY_INTERVAL_MS * 3);

    expect(carousel.scrollTo).not.toHaveBeenCalled();
    expect(carousel.activeDotIndex()).toBe(1);
  });

  it("다른 탭에 가 있는 동안에는 넘어가지 않는다", () => {
    const carousel = mountCarousel();

    carousel.enterViewport();
    carousel.hide();
    carousel.advance(AUTOPLAY_INTERVAL_MS * 2);

    expect(carousel.scrollTo).not.toHaveBeenCalled();

    carousel.show();
    carousel.advance();

    expect(carousel.activeDotIndex()).toBe(1);
  });

  it("움직임을 줄이는 설정이면 자동으로 넘어가지 않는다", () => {
    prefersReducedMotion = true;
    const carousel = mountCarousel();

    carousel.enterViewport();
    carousel.advance(AUTOPLAY_INTERVAL_MS * 3);

    expect(carousel.scrollTo).not.toHaveBeenCalled();
    expect(carousel.activeDotIndex()).toBe(0);
  });

  it("unmount하면 대기 중인 타이머를 정리한다", () => {
    const carousel = mountCarousel({ animateScroll: false });

    carousel.clickNext();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    carousel.unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.advanceTimersByTime(SETTLE_DELAY_MS * 10)).not.toThrow();
  });
});
