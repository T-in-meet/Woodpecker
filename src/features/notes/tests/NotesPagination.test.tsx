import "./setup";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotesPagination } from "../components/NotesPagination";

const buildUrl = (page: number) => `/notes?page=${page}`;

describe("NotesPagination", () => {
  it("totalPages가 1 이하면 렌더링하지 않는다", () => {
    const { container } = render(
      <NotesPagination currentPage={1} totalPages={1} buildUrl={buildUrl} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("현재 페이지는 링크가 아닌 span으로 렌더링해 동일 URL 재요청을 막는다", () => {
    render(
      <NotesPagination currentPage={2} totalPages={5} buildUrl={buildUrl} />,
    );

    const current = screen.getByLabelText("2 페이지");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");
  });

  it("활성(이동 가능) 버튼은 title과 aria-label을 유지한다", () => {
    render(
      <NotesPagination currentPage={3} totalPages={5} buildUrl={buildUrl} />,
    );

    for (const label of [
      "첫 페이지",
      "이전 페이지",
      "다음 페이지",
      "마지막 페이지",
    ]) {
      const el = screen.getByLabelText(label);
      expect(el).toHaveAttribute("title", label);
    }
  });

  it("첫 페이지에서 비활성화된 «·← 버튼도 title과 aria-label을 유지한다", () => {
    render(
      <NotesPagination currentPage={1} totalPages={5} buildUrl={buildUrl} />,
    );

    for (const label of ["첫 페이지", "이전 페이지"]) {
      const el = screen.getByLabelText(label);
      expect(el.tagName).toBe("SPAN");
      expect(el).toHaveAttribute("aria-disabled", "true");
      expect(el).toHaveAttribute("title", label);
    }
  });

  it("마지막 페이지에서 비활성화된 →·» 버튼도 title과 aria-label을 유지한다", () => {
    render(
      <NotesPagination currentPage={5} totalPages={5} buildUrl={buildUrl} />,
    );

    for (const label of ["다음 페이지", "마지막 페이지"]) {
      const el = screen.getByLabelText(label);
      expect(el.tagName).toBe("SPAN");
      expect(el).toHaveAttribute("aria-disabled", "true");
      expect(el).toHaveAttribute("title", label);
    }
  });
});
