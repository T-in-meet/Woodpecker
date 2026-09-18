// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { extensionsGate } = vi.hoisted(() => ({
  extensionsGate: { shouldThrow: false },
}));

vi.mock("server-only", () => ({}));

vi.mock("../utils/tiptapExtensions", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/tiptapExtensions")>();

  return {
    ...actual,
    getReadOnlyTipTapExtensions: () => {
      if (extensionsGate.shouldThrow) throw new Error("boom");
      return actual.getReadOnlyTipTapExtensions();
    },
  };
});

import { renderNoteHtml } from "../utils/renderNoteHtml";

/**
 * 실제 서버 런타임처럼 DOM 전역이 없는 Node 환경에서 렌더가 되는지, 렌더 뒤에
 * happy-dom 전역이 남지 않는지 확인한다. 패리티는 renderNoteHtml.test.ts(jsdom)가 본다.
 */
describe("renderNoteHtml (node)", () => {
  it("DOM 전역 없이 본문을 렌더한다", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");

    const html = renderNoteHtml(
      "# 제목\n\n- {c=red}빨강{/c}\n\n문단\n\n- [ ] 할 일\n\n```javascript\nconst a = 1;\n```",
    );

    expect(html).toContain("<h1>제목</h1>");
    expect(html).toContain('data-note-line-color="red"');
    expect(html).toContain('type="checkbox" disabled="disabled"');
    expect(html).toContain('<span class="hljs-keyword">const</span>');
  });

  it("렌더 뒤에 DOM 전역을 남기지 않는다", () => {
    renderNoteHtml("문단");

    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    expect(typeof HTMLElement).toBe("undefined");
    expect("DOMParser" in globalThis).toBe(false);
  });

  it("렌더 중 예외가 나도 DOM 전역을 되돌린다", () => {
    extensionsGate.shouldThrow = true;

    try {
      expect(() => renderNoteHtml("문단")).toThrow("boom");
    } finally {
      extensionsGate.shouldThrow = false;
    }

    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });
});
