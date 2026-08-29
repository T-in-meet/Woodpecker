import "./setup";

import { fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ScrollToTopButton } from "../components/ScrollToTopButton";

// jsdom에는 matchMedia 구현이 없어 spyOn이 아니라 직접 주입한다.
function setReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
  })) as unknown as typeof window.matchMedia;
}

function getButton() {
  const button = document.querySelector("[aria-label='맨 위로 이동']");
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

function scrollTo(y: number) {
  window.scrollY = y;
  act(() => {
    fireEvent.scroll(window);
  });
}

describe("ScrollToTopButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollY = 0;
    // jsdom은 rAF를 제공하지만 콜백이 다음 틱으로 밀려 테스트가 불안정해진다.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    setReducedMotion(false);
  });

  it("hides the button until the page is scrolled past the threshold", () => {
    render(<ScrollToTopButton />);

    // jsdom은 inert를 접근성 트리에 반영하지 않으므로 label 속성으로 찾는다.
    const button = getButton();
    expect(button.classList.contains("opacity-0")).toBe(true);
    expect(button).toHaveAttribute("inert");
  });

  it("shows the button once scrolled past the threshold", () => {
    render(<ScrollToTopButton />);

    scrollTo(401);

    const button = screen.getByRole("button", { name: "맨 위로 이동" });
    expect(button.classList.contains("opacity-100")).toBe(true);
    expect(button).not.toHaveAttribute("inert");
  });

  it("does not hide the button at desktop widths", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1024,
    });
    render(<ScrollToTopButton />);

    scrollTo(401);

    expect(screen.getByRole("button", { name: "맨 위로 이동" })).toHaveClass(
      "opacity-100",
    );
  });

  it("hides the button again when scrolled back near the top", () => {
    render(<ScrollToTopButton />);

    scrollTo(401);
    scrollTo(100);

    // jsdom은 inert를 접근성 트리에 반영하지 않으므로 label 속성으로 찾는다.
    const button = getButton();
    expect(button.classList.contains("opacity-0")).toBe(true);
    expect(button).toHaveAttribute("inert");
  });

  it("scrolls to the top smoothly on click", () => {
    render(<ScrollToTopButton />);
    scrollTo(401);

    fireEvent.click(screen.getByRole("button", { name: "맨 위로 이동" }));

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });

  // 클릭한 버튼은 포커스를 가진 채 스크롤이 0에 닿아 스스로 숨겨진다.
  // 이때 aria-hidden이 붙으면 브라우저가 경고와 함께 적용을 차단하므로 inert여야 한다.
  it("hides itself with inert rather than aria-hidden after being clicked", () => {
    render(<ScrollToTopButton />);
    scrollTo(401);

    const button = screen.getByRole("button", { name: "맨 위로 이동" });
    button.focus();
    fireEvent.click(button);
    scrollTo(0);

    expect(getButton()).not.toHaveAttribute("aria-hidden");
    expect(getButton()).toHaveAttribute("inert");
  });

  it("skips smooth scrolling when the user prefers reduced motion", () => {
    setReducedMotion(true);

    render(<ScrollToTopButton />);
    scrollTo(401);

    fireEvent.click(screen.getByRole("button", { name: "맨 위로 이동" }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
