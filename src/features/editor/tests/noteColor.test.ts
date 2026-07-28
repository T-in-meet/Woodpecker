import "@/tests/setup";

import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { applyNoteBlockBackground } from "../utils/noteBlockBackground";
import { stripNoteColorSyntax } from "../utils/noteColorMarkdown";
import { getUniformNoteTextColor } from "../utils/noteLineTextColor";
import { serializeTipTapMarkdown } from "../utils/serializeTipTapMarkdown";
import {
  getReadOnlyTipTapExtensions,
  getTipTapExtensions,
} from "../utils/tiptapExtensions";

function createEditor(content: string, extensions = getTipTapExtensions()) {
  return new Editor({ extensions, content, editable: false });
}

function roundTrip(markdown: string, extensions = getTipTapExtensions()) {
  const editor = createEditor(markdown, extensions);
  const result = serializeTipTapMarkdown(editor);
  editor.destroy();
  return result;
}

function getHTML(markdown: string, extensions = getTipTapExtensions()) {
  const editor = createEditor(markdown, extensions);
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

describe("글자색 (인라인)", () => {
  it("글자색 문법을 왕복 직렬화해도 그대로 유지한다", () => {
    expect(roundTrip("{c=red}빨강{/c}")).toBe("{c=red}빨강{/c}");
  });

  it("색 문법을 data 속성이 붙은 span으로 파싱한다", () => {
    const html = getHTML("{c=blue}파랑{/c}");

    expect(html).toContain('data-note-color="blue"');
    expect(html).toContain("파랑");
  });

  it("읽기 전용 확장에서도 색을 그대로 파싱한다", () => {
    const html = getHTML("{c=purple}보라{/c}", getReadOnlyTipTapExtensions());

    expect(html).toContain('data-note-color="purple"');
  });

  it("허용 목록에 없는 색 토큰은 일반 텍스트로 남긴다", () => {
    const result = roundTrip("{c=pink}분홍{/c}");

    expect(result).toContain("분홍");
    expect(result).not.toContain("data-note-color");
  });

  it("짝이 없는 닫는 마커는 텍스트로 보존한다", () => {
    expect(roundTrip("닫기만 {/c} 있음")).toContain("{/c}");
  });

  it("짝이 없는 여는 마커는 텍스트로 보존한다", () => {
    expect(roundTrip("열기만 {c=red} 있음")).toContain("{c=red}");
  });

  // 굵게와 색이 겹치면 마크 순서가 바뀔 수 있으나(**{c=red}…{/c}**) 의미는 같다.
  it("다른 서식과 함께 써도 서식이 유지되고 재직렬화가 안정적이다", () => {
    const result = roundTrip("{c=red}**굵은 빨강**{/c}");

    expect(result).toContain("{c=red}");
    expect(result).toContain("{/c}");
    expect(result).toContain("**");
    expect(result).toContain("굵은 빨강");
    expect(roundTrip(result)).toBe(result);
  });
});

describe("배경색 (블록)", () => {
  it("문단 배경색을 왕복 직렬화해도 그대로 유지한다", () => {
    expect(roundTrip("{bg=orange}주황 문단")).toBe("{bg=orange}주황 문단");
  });

  it("문단 배경색을 블록 요소의 data 속성으로 끌어올린다", () => {
    const html = getHTML("{bg=orange}주황 문단");

    expect(html).toContain('data-note-block-bg="orange"');
    expect(html).toContain("주황 문단");
    // 마커는 본문에서 제거돼야 한다.
    expect(html).not.toContain("{bg=orange}");
  });

  it("제목에도 배경색을 적용한다", () => {
    const html = getHTML("## {bg=blue}파란 제목");

    expect(html).toContain("<h2");
    expect(html).toContain('data-note-block-bg="blue"');
    expect(html).not.toContain("{bg=blue}");
  });

  it("제목 배경색을 왕복 직렬화해도 그대로 유지한다", () => {
    expect(roundTrip("## {bg=blue}파란 제목")).toBe("## {bg=blue}파란 제목");
  });

  it("목록 항목은 항목 전체(li)에 배경색을 적용한다", () => {
    const html = getHTML("- {bg=green}초록 항목");

    expect(html).toContain("<li");
    expect(html).toMatch(/<li[^>]*data-note-block-bg="green"/);
  });

  it("목록 항목 배경색을 왕복 직렬화해도 그대로 유지한다", () => {
    expect(roundTrip("- {bg=green}초록 항목")).toBe("- {bg=green}초록 항목");
  });

  it("연속된 블록에 각각 배경색을 유지한다", () => {
    const markdown = "{bg=orange}첫째\n\n{bg=orange}둘째";

    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("읽기 전용 확장에서도 블록 배경색을 파싱한다", () => {
    const html = getHTML("{bg=red}빨간 문단", getReadOnlyTipTapExtensions());

    expect(html).toContain('data-note-block-bg="red"');
  });

  it("허용 목록에 없는 배경색 토큰은 일반 텍스트로 남긴다", () => {
    const result = roundTrip("{bg=pink}분홍 문단");

    expect(result).toContain("{bg=pink}");
    expect(result).not.toContain("data-note-block-bg");
  });

  it("블록 중간의 마커는 배경색으로 해석하지 않는다", () => {
    const result = roundTrip("앞 {bg=orange} 뒤");

    expect(result).toContain("{bg=orange}");
    expect(result).not.toContain("data-note-block-bg");
  });

  it("글자색과 배경색을 함께 써도 왕복 직렬화가 유지된다", () => {
    const markdown = "{bg=yellow}{c=red}빨간 글자{/c} 노란 배경";

    expect(roundTrip(markdown)).toBe(markdown);
  });

  it("색이 없는 본문은 색 문법을 만들지 않는다", () => {
    expect(roundTrip("그냥 문단")).toBe("그냥 문단");
  });
});

describe("배경색 적용 대상", () => {
  function findTextPosition(editor: Editor, text: string): number {
    let position: number | null = null;

    editor.state.doc.descendants((node, pos) => {
      if (node.isText && node.text?.includes(text)) {
        position = pos;
        return false;
      }

      return true;
    });

    if (position === null) throw new Error(`text node not found: ${text}`);

    return position;
  }

  function applyAtText(markdown: string, text: string) {
    const editor = new Editor({
      extensions: getTipTapExtensions(),
      content: markdown,
    });

    editor.commands.setTextSelection(findTextPosition(editor, text) + 1);
    applyNoteBlockBackground(editor, "green");

    const result = serializeTipTapMarkdown(editor);
    editor.destroy();
    return result;
  }

  it("중첩 목록에서 커서가 놓인 항목에만 배경색을 적용한다", () => {
    const result = applyAtText(
      "- 바깥 항목\n\n    - 안쪽 가\n    - 안쪽 나",
      "안쪽 나",
    );

    expect(result).toContain("{bg=green}안쪽 나");
    expect(result).not.toContain("{bg=green}바깥 항목");
    expect(result).not.toContain("{bg=green}안쪽 가");
  });

  it("커서가 놓인 문단에만 배경색을 적용한다", () => {
    const result = applyAtText("첫 문단\n\n둘째 문단", "둘째 문단");

    expect(result).toContain("{bg=green}둘째 문단");
    expect(result).not.toContain("{bg=green}첫 문단");
  });
});

describe("줄 전체 글자색 (목록 마커)", () => {
  function getListItemLineColor(markdown: string) {
    const editor = createEditor(markdown);
    let token: ReturnType<typeof getUniformNoteTextColor> = null;

    editor.state.doc.descendants((node) => {
      if (node.type.name !== "listItem") return true;

      token = getUniformNoteTextColor(node);
      return false;
    });

    editor.destroy();
    return token;
  }

  it("항목 전체가 한 색이면 그 색을 반환한다", () => {
    expect(getListItemLineColor("- {c=red}빨간 항목{/c}")).toBe("red");
  });

  it("일부만 색이 있으면 줄 색으로 보지 않는다", () => {
    expect(getListItemLineColor("- {c=red}빨강{/c} 그리고 검정")).toBeNull();
  });

  it("색이 섞여 있으면 줄 색으로 보지 않는다", () => {
    expect(
      getListItemLineColor("- {c=red}빨강{/c}{c=blue}파랑{/c}"),
    ).toBeNull();
  });

  it("색이 없으면 null을 반환한다", () => {
    expect(getListItemLineColor("- 그냥 항목")).toBeNull();
  });
});

describe("stripNoteColorSyntax", () => {
  it("평문 복사용으로 색 마커만 제거한다", () => {
    expect(stripNoteColorSyntax("{bg=blue}{c=red}빨강{/c} 문단")).toBe(
      "빨강 문단",
    );
  });

  it("허용 목록에 없는 토큰은 건드리지 않는다", () => {
    expect(stripNoteColorSyntax("{c=pink}분홍{/c}")).toBe("{c=pink}분홍");
  });

  it("색 문법이 없으면 원문을 그대로 둔다", () => {
    expect(stripNoteColorSyntax("그냥 **문단**")).toBe("그냥 **문단**");
  });
});
