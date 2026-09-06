import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { learningToolsContent } from "@/features/landing/content";
import {
  LearningToolsSection,
  MAX_SETTLE_RETRIES,
  SETTLE_DELAY_MS,
} from "@/features/landing/LearningToolsSection";

// jsdom에는 레이아웃이 없어 카드 위치·scrollLeft·scrollTo가 전부 0이거나 없다.
// 캐러셀은 실제 자식 좌표로 현재 장을 판정하므로, 폭이 CARD_WIDTH인 카드가
// 나란히 놓인 스크롤러를 흉내 내 좌표 계산이 돌아가게 만든다.
const CARD_WIDTH = 600;

const tools = learningToolsContent.tools;

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
};

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
  };
}

describe("LearningToolsSection 캐러셀", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // scrollToIndex가 prefers-reduced-motion을 본다. jsdom 구현은 환경마다
    // 달라서 항상 smooth 경로를 타도록 고정한다.
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
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

  it("마지막 장에서 다음을 눌러도 스크롤하지 않는다", () => {
    const carousel = mountCarousel();

    carousel.clickNext();
    carousel.clickNext();
    carousel.settle();
    carousel.scrollTo.mockClear();

    expect(
      screen.getByRole("button", { name: "다음 기능 보기" }),
    ).toHaveAttribute("aria-disabled", "true");

    carousel.clickNext();

    expect(carousel.scrollTo).not.toHaveBeenCalled();
    expect(carousel.activeDotIndex()).toBe(tools.length - 1);
  });

  it("첫 장에서 이전을 눌러도 스크롤하지 않는다", () => {
    const carousel = mountCarousel();

    carousel.clickPrev();

    expect(carousel.scrollTo).not.toHaveBeenCalled();
    expect(carousel.activeDotIndex()).toBe(0);
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

  it("unmount하면 대기 중인 타이머를 정리한다", () => {
    const carousel = mountCarousel({ animateScroll: false });

    carousel.clickNext();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    carousel.unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(() => vi.advanceTimersByTime(SETTLE_DELAY_MS * 10)).not.toThrow();
  });
});
