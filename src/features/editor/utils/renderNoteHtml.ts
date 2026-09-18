import "server-only";

import { Editor } from "@tiptap/core";
import {
  type DOMOutputSpec,
  DOMSerializer,
  type Node as ProseMirrorNode,
} from "@tiptap/pm/model";
import { Window } from "happy-dom";
import type { Root, RootContent } from "hast";
import { cache } from "react";

import { NOTE_LINE_COLOR_ATTRIBUTE } from "./noteColorMarkdown";
import {
  getUniformNoteTextColor,
  NOTE_LINE_COLOR_TYPE_NAMES,
} from "./noteLineTextColor";
import { getReadOnlyTipTapExtensions, lowlight } from "./tiptapExtensions";

/*
 * 노트 본문(마크다운)을 서버에서 읽기 전용 HTML로 렌더한다.
 *
 * 노트 상세는 읽기가 기본인데, 클라이언트에서 TipTap 에디터를 만들어야 본문이
 * 그려지면 에디터 번들 다운로드·하이드레이션·createEditor(측정 기준 380~458 ms)가
 * 끝날 때까지 LCP가 밀린다. 여기서는 클라이언트와 같은 읽기 전용 확장으로 문서를
 * 파싱한 뒤 DOMSerializer로 직렬화해, 서버 HTML에 본문이 바로 실리게 한다.
 *
 * 별도 마크다운 렌더러를 두지 않는 이유: 색·배경·표·체크리스트 파싱이 각 확장의
 * storage.markdown.parse 훅에 흩어져 있어 따로 구현하면 결과가 어긋난다.
 *
 * 다만 EditorView 없이 직렬화하므로 view 시점 decoration으로만 그려지는 두 가지는
 * 여기서 직접 재현한다. decoration 기반 표시를 새로 추가하면 여기에도 미러링해야
 * 하며, renderNoteHtml.test.ts의 패리티 테스트가 그 누락을 잡는다.
 *   1. 코드블록 구문 강조(@tiptap/extension-code-block-lowlight)
 *   2. 목록 항목 마커 색 data-note-line-color(NoteLineTextColor)
 */

// tiptap-markdown은 window.DOMParser를 직접 부르고, 파싱 훅은 HTMLElement 같은
// 전역 생성자로 instanceof 검사를 한다. 서버에는 이 전역이 없으므로 파싱·직렬화가
// 도는 동기 구간에만 happy-dom 전역을 넣었다가 반드시 원래대로 되돌린다.
// 전역이 남으면 `typeof window` 분기로 브라우저를 판별하는 서버 코드가 오동작한다.
const DOM_GLOBAL_KEYS = [
  "window",
  "document",
  "DOMParser",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLImageElement",
  "Text",
  "DocumentFragment",
] as const;

type DomGlobalKey = (typeof DOM_GLOBAL_KEYS)[number];

let headlessWindow: Window | null = null;

function getHeadlessWindow(): Window {
  headlessWindow ??= new Window({ url: "https://localhost/" });
  return headlessWindow;
}

function withHeadlessDom<T>(run: (document: Document) => T): T {
  const win = getHeadlessWindow();
  const globals = globalThis as unknown as Record<DomGlobalKey, unknown>;
  const source = win as unknown as Record<DomGlobalKey, unknown>;
  const previous = new Map<DomGlobalKey, PropertyDescriptor | undefined>();

  for (const key of DOM_GLOBAL_KEYS) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value: key === "window" ? win : source[key],
      configurable: true,
      writable: true,
    });
  }

  try {
    return run(win.document as unknown as Document);
  } finally {
    for (const key of DOM_GLOBAL_KEYS) {
      const descriptor = previous.get(key);

      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete globals[key];
      }
    }
  }
}

type HighlightedSegment = { text: string; classes: string[] };

// DOMOutputSpec 배열의 자식 자리에는 문자열(텍스트 노드)도 올 수 있다.
type SpecChild = DOMOutputSpec | string;

// @tiptap/extension-code-block-lowlight의 parseNodes와 같은 평탄화 규칙.
// 중첩 hast 노드의 클래스를 누적해 텍스트 조각마다 하나의 span으로 만든다.
function flattenHighlightNodes(
  nodes: RootContent[],
  parentClasses: string[] = [],
): HighlightedSegment[] {
  return nodes.flatMap((node) => {
    if (node.type === "element") {
      const own = node.properties.className;
      const classes = [
        ...parentClasses,
        ...(Array.isArray(own) ? own.map(String) : []),
      ];
      return flattenHighlightNodes(node.children, classes);
    }

    if (node.type === "text") {
      return [{ text: node.value, classes: parentClasses }];
    }

    return [];
  });
}

function highlightCodeBlock(node: ProseMirrorNode): SpecChild[] {
  const language =
    typeof node.attrs.language === "string" ? node.attrs.language : null;
  const code = node.textContent;
  // 클라이언트 플러그인과 같은 분기: 등록된 언어면 그 언어로, 아니면 자동 감지.
  const result: Root =
    language && lowlight.registered(language)
      ? lowlight.highlight(language, code)
      : lowlight.highlightAuto(code);

  const segments = flattenHighlightNodes(result.children);

  // 자동 감지가 실패하면 lowlight는 자식 없는 root를 돌려준다. 클라이언트는 그때
  // decoration 없이 원문을 그대로 그리므로 여기서도 평문으로 둔다. 조각을 이어 붙인
  // 결과가 원문과 다르면 어떤 이유로든 본문이 사라진 것이라 같은 폴백을 탄다.
  if (segments.map((segment) => segment.text).join("") !== code) {
    return [code];
  }

  return segments.map((segment) =>
    segment.classes.length
      ? ["span", { class: segment.classes.join(" ") }, segment.text]
      : segment.text,
  );
}

function isAttrsObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !("nodeType" in value)
  );
}

// DOMOutputSpec의 구멍(0)을 주어진 자식 spec으로 채운다.
function fillContentHole(
  spec: DOMOutputSpec,
  children: SpecChild[],
): DOMOutputSpec {
  if (!Array.isArray(spec)) return spec;

  const [tag, ...rest] = spec;
  const filled = rest.flatMap((part): SpecChild[] =>
    part === 0 ? children : [fillContentHole(part as DOMOutputSpec, children)],
  );

  return [tag, ...filled] as DOMOutputSpec;
}

// DOMOutputSpec의 루트 요소 속성에 값을 더한다. 속성 객체가 없으면 만들어 넣는다.
function withRootAttrs(
  spec: DOMOutputSpec,
  attrs: Record<string, string>,
): DOMOutputSpec {
  if (!Array.isArray(spec)) return spec;

  const [tag, second, ...rest] = spec;

  if (isAttrsObject(second)) {
    return [tag, { ...second, ...attrs }, ...rest] as DOMOutputSpec;
  }

  return [
    tag,
    attrs,
    ...(second === undefined ? [] : [second]),
    ...rest,
  ] as DOMOutputSpec;
}

// @tiptap/extension-list TaskItem node view의 접근성 라벨 마크업. renderHTML에는 없고
// node view에서만 붙이므로 서버 출력에서 같은 구조를 만든다.
const VISUALLY_HIDDEN_STYLE =
  "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

function renderTaskItem(
  node: ProseMirrorNode,
  baseSpec: DOMOutputSpec,
): DOMOutputSpec {
  const attrs =
    Array.isArray(baseSpec) && isAttrsObject(baseSpec[1])
      ? { ...baseSpec[1] }
      : {};
  // node view는 data-type을 붙이지 않는다. CSS도 ul[data-type="taskList"]만 본다.
  delete attrs["data-type"];
  const label = `Task item checkbox for ${node.textContent || "empty task item"}`;

  return [
    "li",
    attrs,
    [
      "label",
      [
        "input",
        {
          "aria-label": label,
          type: "checkbox",
          checked: node.attrs.checked ? "checked" : null,
          // 읽기 전용 화면이므로 항상 비활성. 클라이언트는 editor.isEditable로 정한다.
          disabled: "disabled",
        },
      ],
      ["span", { style: VISUALLY_HIDDEN_STYLE }, label],
    ],
    ["div", 0],
  ];
}

function createReadOnlySerializer(editor: Editor): DOMSerializer {
  const nodes = DOMSerializer.nodesFromSchema(editor.schema);
  const marks = DOMSerializer.marksFromSchema(editor.schema);
  const baseCodeBlock = nodes.codeBlock;
  const baseTable = nodes.table;
  const baseTaskItem = nodes.taskItem;

  if (baseTaskItem) {
    nodes.taskItem = (node) => renderTaskItem(node, baseTaskItem(node));
  }

  if (baseCodeBlock) {
    nodes.codeBlock = (node) =>
      fillContentHole(baseCodeBlock(node), highlightCodeBlock(node));
  }

  // 클라이언트는 TableView(node view)가 항상 div.tableWrapper로 감싼다.
  if (baseTable) {
    nodes.table = (node) => ["div", { class: "tableWrapper" }, baseTable(node)];
  }

  for (const typeName of NOTE_LINE_COLOR_TYPE_NAMES) {
    const base = nodes[typeName];

    if (!base) continue;

    nodes[typeName] = (node) => {
      const token = getUniformNoteTextColor(node);
      const spec = base(node);

      return token
        ? withRootAttrs(spec, { [NOTE_LINE_COLOR_ATTRIBUTE]: token })
        : spec;
    };
  }

  return new DOMSerializer(nodes, marks);
}

function renderNoteHtmlUncached(markdown: string): string {
  return withHeadlessDom((document) => {
    // element: null이면 EditorView를 만들지 않는다(headless). 파싱은 Markdown 확장의
    // onBeforeCreate에서 일어나므로 생성 직후 state.doc이 곧 파싱 결과다.
    const editor = new Editor({
      element: null,
      editable: false,
      injectCSS: false,
      extensions: getReadOnlyTipTapExtensions(),
      content: markdown,
    });

    try {
      const container = document.createElement("div");
      createReadOnlySerializer(editor).serializeFragment(
        editor.state.doc.content,
        { document },
        container,
      );

      return container.innerHTML;
    } finally {
      editor.destroy();
    }
  });
}

/** 같은 요청 안에서 같은 본문을 두 번 렌더하지 않도록 React.cache로 감싼다. */
export const renderNoteHtml = cache(renderNoteHtmlUncached);
