import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import GuideDocumentPage from "@/app/(content)/guide/[slug]/page";

import { GuideToc } from "../components/GuideToc";

afterEach(cleanup);

describe("GuideToc", () => {
  it("H2 id로 이동하는 링크를 순서대로 그린다", () => {
    render(
      <GuideToc
        headings={[
          { id: "section-1", text: "첫 절" },
          { id: "retrieval-practice", text: "꺼내기" },
        ]}
      />,
    );

    const links = within(
      screen.getByRole("navigation", { name: "이 글의 차례" }),
    ).getAllByRole("link");

    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#section-1",
      "#retrieval-practice",
    ]);
  });

  it("처음에는 첫 절이 현재 위치다", () => {
    render(
      <GuideToc
        headings={[
          { id: "section-1", text: "첫 절" },
          { id: "section-2", text: "둘째 절" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "첫 절" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getByRole("link", { name: "둘째 절" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("절이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<GuideToc headings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("문서 페이지의 차례", () => {
  it("본문의 모든 H2에 id가 붙고 차례가 그 id로 이동한다", async () => {
    const { container } = render(
      await GuideDocumentPage({
        params: Promise.resolve({ slug: "spaced-repetition" }),
      }),
    );

    const headingIds = Array.from(container.querySelectorAll("h2")).map(
      (heading) => heading.id,
    );
    const tocTargets = within(
      screen.getByRole("navigation", { name: "이 글의 차례" }),
    )
      .getAllByRole("link")
      .map((link) => link.getAttribute("href")?.slice(1));

    expect(headingIds.length).toBeGreaterThan(0);
    expect(headingIds.every((id) => id.length > 0)).toBe(true);
    expect(tocTargets).toEqual(headingIds);
    /* 본문에 직접 쓴 앵커는 순번 id로 덮어쓰지 않는다. */
    expect(tocTargets).toContain("retrieval-practice");
  });
});
