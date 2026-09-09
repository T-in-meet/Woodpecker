import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import { Footer } from "../Footer";

describe("Footer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /* 이 푸터는 랜딩뿐 아니라 (legal) 레이아웃에도 붙는다. href가 "#faq"처럼
     경로 없이 들어가면 /terms에서 /terms#faq로 이동해 아무 데도 가지 않으므로,
     상수 조합 대신 실제 경로 문자열로 못박아 회귀를 잡는다. */
  it("섹션 앵커 링크에 랜딩 경로가 포함된다", () => {
    render(<Footer />);

    expect(
      screen.getByRole("link", { name: "자주 묻는 질문" }),
    ).toHaveAttribute("href", "/#faq");
    expect(screen.getByRole("link", { name: "기능 소개" })).toHaveAttribute(
      "href",
      "/#features",
    );
  });

  it("법적 고지 문서로 가는 링크를 노출한다", () => {
    render(<Footer />);

    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute(
      "href",
      ROUTES.TERMS,
    );
    expect(
      screen.getByRole("link", { name: "개인정보처리방침" }),
    ).toHaveAttribute("href", ROUTES.PRIVACY);
  });

  it("링크 묶음을 이름 있는 내비게이션 랜드마크로 노출한다", () => {
    render(<Footer />);

    expect(
      screen.getByRole("navigation", { name: "푸터 링크" }),
    ).toBeInTheDocument();
  });

  /* 배포 서버는 UTC라 getFullYear()를 그대로 쓰면 이 시각에 2026이 찍힌다. */
  it("카피라이트 연도를 KST 기준으로 계산한다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T20:00:00Z")); // KST 2027-01-01 05:00

    render(<Footer />);

    expect(screen.getByText(/2027 딱다구리/)).toBeInTheDocument();
  });
});
