import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { getReadOnlyTipTapExtensions } from "../utils/tiptapExtensions";

vi.mock("server-only", () => ({}));

import { renderNoteHtml } from "../utils/renderNoteHtml";

/**
 * 서버 렌더(renderNoteHtml)와 클라이언트 읽기 전용 에디터(EditorView)가 같은
 * 마크다운에서 같은 DOM을 내는지 검증한다. decoration으로만 그려지는 표시
 * (코드블록 강조·목록 마커 색)를 서버가 빠뜨리면 여기서 어긋난다.
 */
function renderWithEditorView(markdown: string): string {
  const element = document.createElement("div");
  const editor = new Editor({
    element,
    editable: false,
    injectCSS: false,
    extensions: getReadOnlyTipTapExtensions(),
    content: markdown,
  });

  try {
    return editor.view.dom.innerHTML;
  } finally {
    editor.destroy();
  }
}

// ProseMirror가 편집·커서 처리를 위해 붙이는 표식은 서버 출력에 없으므로 제거한다.
function normalize(html: string): string {
  return (
    html
      .replace(/<br class="ProseMirror-trailingBreak">/g, "")
      .replace(/<img class="ProseMirror-separator"[^>]*>/g, "")
      .replace(/ (contenteditable|draggable)="[^"]*"/g, "")
      // 문서가 atom 하나뿐이면 초기 선택이 그 노드에 걸려 선택 표시 클래스가 붙는다.
      .replace(/ ProseMirror-selectednode/g, "")
      .replace(/\s+class=""/g, "")
      // node view는 checked·disabled를 DOM 속성(property)으로만 두고, 인라인 style은
      // 브라우저가 정규화해 직렬화한다. 서버는 HTML 속성으로 내므로 표기를 맞춘다.
      .replace(/ checked="checked"/g, "")
      .replace(/ disabled=""/g, ' disabled="disabled"')
      .replace(/ style="([^"]*)"/g, (_, value: string) => {
        const compact = value
          .replace(/\s+/g, "")
          .replace(/(^|[^\d.])0px/g, "$10");
        return ` style="${compact.endsWith(";") ? compact : `${compact};`}"`;
      })
      .replace(/>\s+</g, "><")
      .trim()
  );
}

const FIXTURES = {
  "제목·문단·강조":
    "# 제목\n\n본문 **굵게** *기울임* ~~취소~~ `코드`\n\n## 소제목",
  "글자색 인라인": "{c=red}빨강{/c} 기본 {c=blue}파랑{/c}",
  "블록 배경색": "{bg=yellow}노란 문단\n\n{bg=green}- 초록 목록\n- 두 번째",
  "항목 전체 단색 목록(마커 색)":
    "- {c=purple}보라 항목{/c}\n- 섞인 {c=purple}항목{/c}\n- 기본",
  "중첩 목록": "- 하나\n  - 둘\n    - 셋\n- 넷",
  "시작 번호가 3인 순서 목록": "3. 셋\n4. 넷",
  체크리스트: "- [ ] 할 일\n- [x] 끝난 일\n  - [ ] 중첩",
  "일반 항목과 섞인 체크 표시": "- {c=red}빨강{/c}\n- [ ] 할 일",
  "이스케이프된 체크 표시": "- \\[ \\] first",
  "코드블록 javascript":
    "```javascript\nconst answer = 42; // 주석\nfunction f(a) { return `${a}` }\n```",
  "코드블록 python": "```python\ndef f(x):\n    return x * 2\n```",
  "코드블록 미등록 언어": "```ruby\nputs 'hi'\n```",
  "코드블록 언어 없음": "```\nSELECT * FROM notes;\n```",
  표: "| a | b |\n| --- | :-: |\n| 1 | 2 |",
  링크: "[OpenAI](https://openai.com) 와 <https://example.com>",
  이미지: "![Architecture diagram](https://example.com/diagram.png)",
  "비안전 이미지": "![Unsafe image](javascript:alert(1))",
  "상대 경로 이미지": "![Relative image](../api/internal.png)",
  "인용·구분선": "> 인용\n\n---\n\n끝",
  줄바꿈: "첫 줄\n둘째 줄",
} satisfies Record<string, string>;

describe("renderNoteHtml", () => {
  describe("클라이언트 읽기 전용 에디터와 같은 DOM을 낸다", () => {
    for (const [name, markdown] of Object.entries(FIXTURES)) {
      it(name, () => {
        expect(normalize(renderNoteHtml(markdown))).toBe(
          normalize(renderWithEditorView(markdown)),
        );
      });
    }
  });

  it("코드블록을 hljs 클래스로 강조한다", () => {
    const html = renderNoteHtml(FIXTURES["코드블록 javascript"]);

    expect(html).toContain('<pre><code class="language-javascript"');
    expect(html).toContain('class="hljs-keyword"');
  });

  it("항목 전체가 한 색인 목록 항목에 마커 색을 붙인다", () => {
    const html = renderNoteHtml(FIXTURES["항목 전체 단색 목록(마커 색)"]);

    expect(html.match(/data-note-line-color="purple"/g)).toHaveLength(1);
  });

  it("체크박스를 비활성 상태로 렌더한다", () => {
    const html = renderNoteHtml(FIXTURES["체크리스트"]);

    expect(html.match(/<input [^>]*disabled="disabled"/g)).toHaveLength(3);
    expect(html.match(/<input [^>]*checked="checked"/g)).toHaveLength(1);
  });

  it("안전하지 않은 이미지 주소는 렌더하지 않는다", () => {
    expect(renderNoteHtml(FIXTURES["비안전 이미지"])).not.toContain("<img");
    expect(renderNoteHtml(FIXTURES["상대 경로 이미지"])).not.toContain("<img");
  });

  it("본문 속 HTML 태그는 이스케이프된 텍스트로만 나온다", () => {
    const html = renderNoteHtml(
      '<script>alert(1)</script><b onclick="x">굵게</b>',
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b ");
    expect(html).toContain("&lt;script&gt;");
  });

  it("렌더 후 DOM 전역을 원래대로 되돌린다", () => {
    const before = {
      window: globalThis.window,
      document: globalThis.document,
      HTMLElement: globalThis.HTMLElement,
    };

    renderNoteHtml("# 제목");

    expect(globalThis.window).toBe(before.window);
    expect(globalThis.document).toBe(before.document);
    expect(globalThis.HTMLElement).toBe(before.HTMLElement);
  });
});
