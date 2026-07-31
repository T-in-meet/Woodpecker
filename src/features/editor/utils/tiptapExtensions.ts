import {
  Extension,
  InputRule,
  isAtStartOfNode,
  isNodeActive,
  Mark,
  mergeAttributes,
  nodeInputRule,
  nodePasteRule,
  type NodeViewRenderer,
  type NodeViewRendererProps,
} from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Image, { inputRegex as imageInputRegex } from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Table,
  TableCell,
  TableHeader,
  TableRow,
} from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import {
  defaultMarkdownSerializer,
  MarkdownSerializerState,
} from "@tiptap/pm/markdown";
import {
  type Attrs,
  type Fragment,
  type Mark as ProseMirrorMark,
  type Node as ProseMirrorNode,
  type NodeType,
  type ResolvedPos,
} from "@tiptap/pm/model";
import {
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import typescript from "highlight.js/lib/languages/typescript";
import { createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";

import { slashCommandSuggestionRender } from "../components/SlashCommandMenu";
import { normalizeNoteColorToken } from "../noteColors";
import { isSafeLinkHref, normalizeImageSrc } from "./linkValidation";
import {
  hoistNoteBlockBackgroundMarkers,
  NOTE_BLOCK_BACKGROUND_ATTRIBUTE_NAME,
  NOTE_BLOCK_BACKGROUND_TYPE_NAMES,
} from "./noteBlockBackground";
import {
  buildNoteTextColorCloseMarkup,
  buildNoteTextColorOpenMarkup,
  NOTE_BLOCK_BACKGROUND_ATTRIBUTE,
  NOTE_COLOR_ATTRIBUTE,
  NOTE_LINE_COLOR_ATTRIBUTE,
  NOTE_TEXT_COLOR_MARK_NAME,
  type NoteColorMarkdownItType,
  setupNoteColorMarkdownIt,
  stripNoteColorSyntax,
} from "./noteColorMarkdown";
import {
  getUniformNoteTextColor,
  NOTE_LINE_COLOR_TYPE_NAMES,
} from "./noteLineTextColor";
import { SlashCommand } from "./slashCommand";

const LINE_COLOR_TYPES = new Set<string>(NOTE_LINE_COLOR_TYPE_NAMES);

const lowlight = createLowlight();
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("python", python);
lowlight.register("rust", rust);
lowlight.register("go", go);

const LIST_ITEM_TYPE_NAMES = ["listItem", "taskItem"] as const;
const TASK_MARKER_IN_BULLET_LIST_INPUT_REGEX = /^\[( |x|X)\][ ]$/;
const BULLET_MARKER_IN_ORDERED_LIST_INPUT_REGEX = /^\s*([-+*])\s$/;
// StarterKit HorizontalRule의 입력 규칙과 같은 패턴.
const DIVIDER_INPUT_REGEX = /^(?:---|—-|___\s|\*\*\*\s)$/;
// 입력 중인 마커 문자만 들어 있는지 확인해 남의 항목을 지우지 않도록 한다.
const DIVIDER_MARKER_ONLY_REGEX = /^[-_*—\s]*$/;

type TableCellAlignmentType = "left" | "center" | "right" | null;

type RuntimeMarkdownSerializerState = MarkdownSerializerState & {
  marks: Record<string, unknown>;
  nodes: Record<
    string,
    (
      state: MarkdownSerializerState,
      node: ProseMirrorNode,
      parent: ProseMirrorNode,
      index: number,
    ) => void
  >;
  out: string;
};

type MarkdownSerializerStateConstructorType = new (
  nodes: RuntimeMarkdownSerializerState["nodes"],
  marks: RuntimeMarkdownSerializerState["marks"],
  options: RuntimeMarkdownSerializerState["options"],
) => RuntimeMarkdownSerializerState;

const MarkdownSerializerStateConstructor =
  MarkdownSerializerState as unknown as MarkdownSerializerStateConstructorType;

function getTableCells(row: ProseMirrorNode): ProseMirrorNode[] {
  const cells: ProseMirrorNode[] = [];

  row.forEach((cell) => {
    cells.push(cell);
  });

  return cells;
}

function getTableCellAlignment(
  cell: ProseMirrorNode | null | undefined,
): TableCellAlignmentType {
  if (!cell || typeof cell.attrs.align !== "string") {
    return null;
  }

  if (
    cell.attrs.align === "left" ||
    cell.attrs.align === "center" ||
    cell.attrs.align === "right"
  ) {
    return cell.attrs.align;
  }

  return null;
}

function findAncestorDepth(
  $from: ResolvedPos,
  typeName: string,
): number | null {
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if ($from.node(depth).type.name === typeName) {
      return depth;
    }
  }

  return null;
}

function renderInlineMarkdown(
  state: MarkdownSerializerState,
  node: ProseMirrorNode,
): string {
  const runtimeState = state as RuntimeMarkdownSerializerState;
  const tempState = new MarkdownSerializerStateConstructor(
    runtimeState.nodes,
    runtimeState.marks,
    runtimeState.options,
  );

  tempState.renderInline(node);

  return tempState.out.trim();
}

function getTableCellMarkdown(
  state: MarkdownSerializerState,
  cell: ProseMirrorNode | null | undefined,
): string {
  if (!cell) {
    return "";
  }

  const parts: string[] = [];

  cell.forEach((child) => {
    const text = child.type.inlineContent
      ? renderInlineMarkdown(state, child)
      : child.textContent.replace(/\s+/g, " ").trim();

    if (text) {
      parts.push(text);
    }
  });

  return parts.join(" ");
}

function getTableDividerCell(alignment: TableCellAlignmentType): string {
  if (alignment === "left") {
    return ":---";
  }

  if (alignment === "right") {
    return "---:";
  }

  if (alignment === "center") {
    return ":---:";
  }

  return "---";
}

function writeMarkdownTableRow(
  state: MarkdownSerializerState,
  cells: string[],
) {
  state.write(`| ${cells.join(" | ")} |`);
  state.ensureNewLine();
}

function isPureTaskListElement(list: Element): boolean {
  const items = Array.from(list.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.tagName === "LI",
  );

  return (
    items.length > 0 &&
    items.every(
      (item) =>
        item.classList.contains("task-list-item") &&
        item.querySelector('input[type="checkbox"]') !== null,
    )
  );
}

// tiptap-markdown는 혼합 리스트(일반 + task item)를 파싱할 때 모든 항목에 task-list-item 클래스를 부여한다.
// ProseMirror가 이를 그대로 받으면 일반 항목도 체크박스로 렌더링되므로,
// parse 단계에서 DOM을 직접 수정하여 순수 task list만 taskItem으로 변환한다.
const MarkdownTaskItem = TaskItem.extend({
  addStorage() {
    return {
      markdown: {
        parse: {
          updateDOM(element: HTMLElement) {
            // DOM 수정 전에 pure task list를 미리 판별 (checkbox 제거 이후 재판별 오류 방지)
            const pureLists = new Set<Element>();
            for (const ul of element.querySelectorAll("ul")) {
              if (isPureTaskListElement(ul)) {
                pureLists.add(ul);
              }
            }

            for (const item of element.querySelectorAll(".task-list-item")) {
              if (!(item instanceof HTMLElement)) continue;

              const parentList = item.closest("ul");
              const input = item.querySelector("input");

              if (!parentList || !pureLists.has(parentList)) {
                parentList?.removeAttribute("data-type");
                item.removeAttribute("data-type");
                item.removeAttribute("data-checked");
                item.classList.remove("task-list-item");

                if (input instanceof HTMLInputElement) {
                  const marker = input.checked ? "[x] " : "[ ] ";
                  input.replaceWith(item.ownerDocument.createTextNode(marker));
                }

                continue;
              }

              item.setAttribute("data-type", "taskItem");

              if (input instanceof HTMLInputElement) {
                item.setAttribute("data-checked", String(input.checked));
                input.remove();
              }
            }
          },
        },
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const isReadOnly = !this.editor?.isEditable;

    return [
      "li",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-type": this.name,
      }),
      [
        "label",
        [
          "input",
          {
            type: "checkbox",
            checked: node.attrs.checked ? "checked" : null,
            disabled: isReadOnly ? "disabled" : null,
          },
        ],
        ["span"],
      ],
      ["div", 0],
    ];
  },
  addNodeView() {
    const parentNodeView = this.parent?.() as NodeViewRenderer | undefined;

    if (!parentNodeView) {
      return null;
    }

    return (props: NodeViewRendererProps) => {
      const nodeView = parentNodeView(props);
      const checkbox =
        nodeView.dom instanceof Element
          ? nodeView.dom.querySelector('input[type="checkbox"]')
          : null;

      if (checkbox instanceof HTMLInputElement) {
        checkbox.disabled = !props.editor.isEditable;
      }

      return nodeView;
    };
  },
});

const ListItemBackspaceLift = Extension.create({
  name: "listItemBackspaceLift",
  priority: 1100,
  addKeyboardShortcuts() {
    const liftCurrentListItem = () => {
      if (this.editor.commands.undoInputRule()) {
        return true;
      }

      const { state } = this.editor;

      if (state.selection.from !== state.selection.to) {
        return false;
      }

      const { $from } = state.selection;

      if (!isAtStartOfNode(state)) {
        return false;
      }

      for (const itemName of LIST_ITEM_TYPE_NAMES) {
        let listItemDepth: number | null = null;

        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === itemName) {
            listItemDepth = depth;
            break;
          }
        }

        if (listItemDepth === null || !isNodeActive(state, itemName)) {
          continue;
        }

        if ($from.node(listItemDepth).firstChild !== $from.parent) {
          return (
            this.editor.commands.joinBackward() ||
            this.editor.commands.joinTextblockBackward()
          );
        }

        // StarterKit's list keymap prefers merging with the previous item.
        // At the start of a list item, we want Backspace to remove the marker first.
        return this.editor.commands.liftListItem(itemName);
      }

      return false;
    };

    return {
      Backspace: liftCurrentListItem,
      "Mod-Backspace": liftCurrentListItem,
    };
  },
});

type ListItemConversionOptionsType = {
  state: EditorState;
  range: { from: number; to: number };
  sourceListType: NodeType;
  sourceItemType: NodeType;
  targetListType: NodeType;
  targetItemType: NodeType;
  targetItemAttrs: Attrs | null;
};

// 커서가 있는 리스트 항목 하나만 다른 종류의 리스트로 바꾼다. 앞뒤 형제 항목은 원래
// 리스트로 남기므로, 목록 중간에서 마커를 바꿔도 나머지 항목이 흐트러지지 않는다.
function convertListItemToList({
  state,
  range,
  sourceListType,
  sourceItemType,
  targetListType,
  targetItemType,
  targetItemAttrs,
}: ListItemConversionOptionsType): boolean {
  const { $from } = state.selection;
  const listItemDepth = findAncestorDepth($from, sourceItemType.name);
  const listDepth = findAncestorDepth($from, sourceListType.name);

  if (listItemDepth === null || listDepth === null) {
    return false;
  }

  let itemIndex = $from.index(listDepth);
  const listNode = $from.node(listDepth);
  const listPosition = $from.before(listDepth);
  const previousListItemNode =
    itemIndex > 0 ? listNode.maybeChild(itemIndex - 1) : null;

  if (
    $from.parentOffset === 0 &&
    previousListItemNode?.type === sourceItemType &&
    previousListItemNode.childCount === 1 &&
    previousListItemNode.firstChild?.type.name === "paragraph" &&
    previousListItemNode.textContent === ""
  ) {
    // Empty list item boundaries resolve forward into the next item, so
    // the marker typed in that empty item would otherwise convert its sibling.
    itemIndex -= 1;
  }

  if (itemIndex < 0 || itemIndex >= listNode.childCount) {
    return false;
  }

  const tr = state.tr.delete(range.from, range.to);
  const mappedListPosition = tr.mapping.map(listPosition);
  const nextListNode = tr.doc.nodeAt(mappedListPosition);
  const nextListItemNode = nextListNode?.maybeChild(itemIndex);

  if (
    !nextListNode ||
    nextListNode.type !== sourceListType ||
    !nextListItemNode ||
    !targetItemType.validContent(nextListItemNode.content)
  ) {
    return false;
  }

  const targetItemNode = targetItemType.create(
    targetItemAttrs,
    nextListItemNode.content,
  );
  const targetListNode = targetListType.create(null, targetItemNode);
  const replacementNodes: ProseMirrorNode[] = [];
  let targetListPosition = mappedListPosition;

  if (itemIndex > 0) {
    const previousItems = Array.from({ length: itemIndex }, (_, index) =>
      nextListNode.child(index),
    );
    const previousListNode = sourceListType.create(
      nextListNode.attrs,
      previousItems,
    );

    replacementNodes.push(previousListNode);
    targetListPosition += previousListNode.nodeSize;
  }

  replacementNodes.push(targetListNode);

  if (itemIndex < nextListNode.childCount - 1) {
    replacementNodes.push(
      sourceListType.create(
        nextListNode.attrs,
        Array.from(
          { length: nextListNode.childCount - itemIndex - 1 },
          (_, index) => nextListNode.child(itemIndex + index + 1),
        ),
      ),
    );
  }

  tr.replaceWith(
    mappedListPosition,
    mappedListPosition + nextListNode.nodeSize,
    replacementNodes,
  );
  // ProseMirror 포지션은 리스트/항목/문단 경계를 각각 1칸씩 지난다.
  tr.setSelection(TextSelection.near(tr.doc.resolve(targetListPosition + 3)));

  return true;
}

const BulletTaskItemInputRule = Extension.create({
  name: "bulletTaskItemInputRule",
  priority: 1200,
  addInputRules() {
    return [
      new InputRule({
        find: TASK_MARKER_IN_BULLET_LIST_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const marker = match[1];
          const bulletListType = state.schema.nodes.bulletList;
          const listItemType = state.schema.nodes.listItem;
          const taskListType = state.schema.nodes.taskList;
          const taskItemType = state.schema.nodes.taskItem;

          if (
            !marker ||
            !bulletListType ||
            !listItemType ||
            !taskListType ||
            !taskItemType
          ) {
            return null;
          }

          // 변환에 실패하면 null을 돌려줘야 TipTap이 이 규칙을 건너뛰고 다음 규칙을 본다.
          if (
            !convertListItemToList({
              state,
              range,
              sourceListType: bulletListType,
              sourceItemType: listItemType,
              targetListType: taskListType,
              targetItemType: taskItemType,
              targetItemAttrs: { checked: marker.toLowerCase() === "x" },
            })
          ) {
            return null;
          }
        },
      }),
    ];
  },
});

// 번호 목록 항목에서 "- "를 치면 노션처럼 그 항목만 글머리 기호 목록으로 바뀐다.
// StarterKit의 bulletList 규칙은 wrappingInputRule이라 listItem 안에서는 findWrapping이
// 실패해 발동하지 않고, 입력한 마커가 텍스트로 남아버린다.
const OrderedBulletItemInputRule = Extension.create({
  name: "orderedBulletItemInputRule",
  priority: 1200,
  addInputRules() {
    return [
      new InputRule({
        find: BULLET_MARKER_IN_ORDERED_LIST_INPUT_REGEX,
        handler: ({ state, range }) => {
          const orderedListType = state.schema.nodes.orderedList;
          const bulletListType = state.schema.nodes.bulletList;
          const listItemType = state.schema.nodes.listItem;

          if (!orderedListType || !bulletListType || !listItemType) {
            return null;
          }

          // 번호 목록 밖에서 친 "- "는 여기서 null을 돌려줘야 StarterKit의 기본
          // bulletList 규칙이 이어서 동작한다.
          if (
            !convertListItemToList({
              state,
              range,
              sourceListType: orderedListType,
              sourceItemType: listItemType,
              targetListType: bulletListType,
              targetItemType: listItemType,
              targetItemAttrs: null,
            })
          ) {
            return null;
          }
        },
      }),
    ];
  },
});

// StarterKit 기본 규칙은 구분선을 끼워 넣기만 해서, 마커를 입력한 문단이 빈 채로 남거나
// 목록 항목 안에 구분선이 갇힌다. 마커만 있던 블록 자체를 구분선으로 교체해 두 경우 모두
// 군더더기 없이 만든다(블록 메뉴·슬래시 명령의 구분선 삽입과 같은 결과).
const DividerInputRule = Extension.create({
  name: "dividerInputRule",
  priority: 1200,
  addInputRules() {
    return [
      new InputRule({
        find: DIVIDER_INPUT_REGEX,
        handler: ({ state }) => {
          const horizontalRuleType = state.schema.nodes.horizontalRule;

          if (!horizontalRuleType) {
            return null;
          }

          const { $from } = state.selection;
          const listItemDepth = LIST_ITEM_TYPE_NAMES.reduce<number | null>(
            (depth, itemName) => depth ?? findAncestorDepth($from, itemName),
            null,
          );
          // 목록 항목이면 항목 전체를, 아니면 마커를 입력한 문단만 교체한다.
          const targetDepth = listItemDepth ?? $from.depth;
          const targetNode = $from.node(targetDepth);

          // 중첩 목록 등 다른 내용이 딸린 항목은 통째로 지우면 안 되므로 기본 규칙에 맡긴다.
          if (listItemDepth !== null && targetNode.childCount !== 1) {
            return null;
          }

          // 빈 항목의 경계는 다음 항목으로 해석되는 경우가 있다. 입력 중인 마커 외에
          // 다른 내용이 있으면 남의 블록을 지우는 셈이므로 건드리지 않는다.
          if (!DIVIDER_MARKER_ONLY_REGEX.test(targetNode.textContent)) {
            return null;
          }

          const targetTo = $from.after(targetDepth);
          const tr = state.tr.replaceRangeWith(
            $from.before(targetDepth),
            targetTo,
            horizontalRuleType.create(),
          );
          const positionAfterDivider = tr.mapping.map(targetTo);
          const paragraphType = state.schema.nodes.paragraph;

          // 교체 직후에는 구분선이 선택된 상태라, 이어서 입력하면 구분선이 덮어쓰기 된다.
          // 뒤쪽에 쓸 자리를 만들고 커서를 그리로 옮긴다.
          if (
            !tr.doc.resolve(positionAfterDivider).nodeAfter &&
            paragraphType
          ) {
            tr.insert(positionAfterDivider, paragraphType.create());
          }

          tr.setSelection(
            TextSelection.near(tr.doc.resolve(positionAfterDivider), 1),
          );
        },
      }),
    ];
  },
});

const MarkdownTable = Table.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: MarkdownSerializerState, node: ProseMirrorNode) {
          const rows = getTableCells(node);
          const columnCount = rows.reduce(
            (max, row) => Math.max(max, row.childCount),
            0,
          );

          if (columnCount === 0) {
            state.closeBlock(node);
            return;
          }

          const headerRow = rows[0];
          const hasHeaderRow =
            headerRow?.childCount !== undefined &&
            getTableCells(headerRow).some(
              (cell) => cell.type.name === "tableHeader",
            );

          const bodyRows = hasHeaderRow ? rows.slice(1) : rows;
          const alignments = Array.from({ length: columnCount }, (_, index) => {
            for (const row of rows) {
              const alignment = getTableCellAlignment(row.maybeChild(index));

              if (alignment) {
                return alignment;
              }
            }

            return null;
          });

          // tiptap-markdown falls back to "[table]" when a cell contains
          // multiple blocks. Flattening cells keeps notes persistable as GFM.
          writeMarkdownTableRow(
            state,
            Array.from({ length: columnCount }, (_, index) =>
              hasHeaderRow
                ? getTableCellMarkdown(state, headerRow?.maybeChild(index))
                : "",
            ),
          );
          writeMarkdownTableRow(
            state,
            alignments.map((alignment) => getTableDividerCell(alignment)),
          );

          for (const row of bodyRows) {
            writeMarkdownTableRow(
              state,
              Array.from({ length: columnCount }, (_, index) =>
                getTableCellMarkdown(state, row.maybeChild(index)),
              ),
            );
          }

          state.closeBlock(node);
        },
      },
    };
  },
});

type SafeImageInputAttributesType = {
  src: string;
  alt: string | null;
  title: string | null;
};

const safeImagePasteRegex =
  /(?:^|\s)(!\[(.*?)\]\((<[^>\n]+>|\S+)(?:(?:\s+)["'](\S+)["'])?\))/g;

function getSafeImageAttributes(
  alt: unknown,
  rawSrc: unknown,
  title: unknown,
): SafeImageInputAttributesType | null {
  if (typeof rawSrc !== "string") {
    return null;
  }

  const src = normalizeImageSrc(rawSrc);

  if (!src) {
    return null;
  }

  return {
    src,
    alt: typeof alt === "string" ? alt : null,
    title: typeof title === "string" ? title : null,
  };
}

function getSafeImageInputAttributes(match: {
  data?: Record<string, unknown>;
}): SafeImageInputAttributesType | false {
  const src = typeof match.data?.src === "string" ? match.data.src : null;

  if (!src) {
    return false;
  }

  return {
    src,
    alt: typeof match.data?.alt === "string" ? match.data.alt : null,
    title: typeof match.data?.title === "string" ? match.data.title : null,
  };
}

function findSafeImageInputRuleMatch(text: string) {
  const match = imageInputRegex.exec(text);

  if (!match) {
    return null;
  }

  const [, imageMarkdown, alt, rawSrc, title] = match;

  if (typeof imageMarkdown !== "string" || typeof rawSrc !== "string") {
    return null;
  }

  const data = getSafeImageAttributes(alt, rawSrc, title);

  if (!data) {
    return null;
  }

  return {
    index: match.index ?? 0,
    text: match[0],
    replaceWith: imageMarkdown,
    data,
  };
}

function findSafeImagePasteRuleMatches(text: string) {
  const matches = Array.from(text.matchAll(safeImagePasteRegex));

  return matches.flatMap((match) => {
    const [, imageMarkdown, alt, rawSrc, title] = match;

    if (typeof imageMarkdown !== "string") {
      return [];
    }

    const data = getSafeImageAttributes(alt, rawSrc, title);

    if (!data) {
      return [];
    }

    const fullMatch = typeof match[0] === "string" ? match[0] : imageMarkdown;
    const imageMarkdownOffset = fullMatch.lastIndexOf(imageMarkdown);

    return [
      {
        index: (match.index ?? 0) + Math.max(0, imageMarkdownOffset),
        text: imageMarkdown,
        data,
      },
    ];
  });
}

const SafeImage = Image.extend({
  addStorage() {
    return {
      markdown: {
        // tiptap-markdown reads node-specific storage.markdown hooks during
        // parse/serialize, so image sanitization lives here to cover every
        // markdown entry point with the same validator.
        serialize(
          state: MarkdownSerializerState,
          node: ProseMirrorNode,
          parent: ProseMirrorNode,
          index: number,
        ) {
          const src =
            typeof node.attrs.src === "string"
              ? normalizeImageSrc(node.attrs.src)
              : null;

          if (!src) {
            return;
          }

          const serializeImage = defaultMarkdownSerializer.nodes.image;

          if (!serializeImage) {
            return;
          }

          const normalizedNode = node.type.create(
            {
              ...node.attrs,
              src,
            },
            null,
            node.marks,
          );

          serializeImage(state, normalizedNode, parent, index);
        },
        parse: {
          updateDOM(element: HTMLElement) {
            for (const image of element.querySelectorAll("img[src]")) {
              if (!(image instanceof HTMLImageElement)) continue;

              const src = image.getAttribute("src");
              const normalizedSrc =
                typeof src === "string" ? normalizeImageSrc(src) : null;

              if (!normalizedSrc) {
                image.remove();
                continue;
              }

              image.setAttribute("src", normalizedSrc);
            }
          },
        },
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    const src =
      typeof HTMLAttributes.src === "string"
        ? normalizeImageSrc(HTMLAttributes.src)
        : null;

    if (!src) {
      return ["span", { "data-invalid-image": "true", hidden: "hidden" }];
    }

    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { src }),
    ];
  },
  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          const src = normalizeImageSrc(options.src);

          if (!src) {
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs: {
              ...options,
              src,
            },
          });
        },
    };
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: findSafeImageInputRuleMatch,
        type: this.type,
        getAttributes: getSafeImageInputAttributes,
      }),
    ];
  },
  addPasteRules() {
    return [
      nodePasteRule({
        find: findSafeImagePasteRuleMatches,
        type: this.type,
        getAttributes: getSafeImageInputAttributes,
      }),
    ];
  },
});

// 글자색은 문자 단위라 인라인 마크로, 배경색은 블록 전체를 칠해야 해서
// 블록 노드의 attribute로 다룬다.
const NoteTextColorMark = Mark.create({
  name: NOTE_TEXT_COLOR_MARK_NAME,
  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          normalizeNoteColorToken(element.getAttribute(NOTE_COLOR_ATTRIBUTE)),
        renderHTML: (attributes: Record<string, unknown>) => {
          const token = normalizeNoteColorToken(attributes.token);

          return token ? { [NOTE_COLOR_ATTRIBUTE]: token } : {};
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: `span[${NOTE_COLOR_ATTRIBUTE}]` }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
  addStorage() {
    return {
      markdown: {
        serialize: {
          open: (_state: MarkdownSerializerState, mark: ProseMirrorMark) =>
            buildNoteTextColorOpenMarkup(
              normalizeNoteColorToken(mark.attrs.token),
            ),
          close: (_state: MarkdownSerializerState, mark: ProseMirrorMark) =>
            buildNoteTextColorCloseMarkup(
              normalizeNoteColorToken(mark.attrs.token),
            ),
          mixable: true,
          expelEnclosingWhitespace: true,
        },
        parse: {
          setup(md: NoteColorMarkdownItType) {
            setupNoteColorMarkdownIt(md);
          },
        },
      },
    };
  },
});

// 목록 마커는 항목의 color를 따르므로 인라인 마크만으로는 색이 입혀지지 않는다.
// 항목 전체가 한 색일 때만 항목에 표시를 붙여 CSS가 마커까지 물들이게 한다.
// 저장되는 값이 아니라 문서에서 매번 계산하는 파생 상태라 decoration으로 처리한다.
const NoteLineTextColor = Extension.create({
  name: "noteLineTextColor",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("noteLineTextColor"),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (!LINE_COLOR_TYPES.has(node.type.name)) return true;

              const token = getUniformNoteTextColor(node);

              if (token) {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    [NOTE_LINE_COLOR_ATTRIBUTE]: token,
                  }),
                );
              }

              return true;
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

const NoteBlockBackground = Extension.create({
  name: "noteBlockBackground",
  addGlobalAttributes() {
    return [
      {
        types: [...NOTE_BLOCK_BACKGROUND_TYPE_NAMES],
        attributes: {
          [NOTE_BLOCK_BACKGROUND_ATTRIBUTE_NAME]: {
            default: null,
            // Enter로 만든 다음 블록은 배경을 물려받지 않는다. 물려받으면 색 블록이
            // 문서 끝에 있을 때 무색 블록으로 빠져나갈 방법이 없다.
            // splitBlock과 splitListItem이 모두 이 값을 보므로 문단·헤딩·목록 항목에
            // 함께 적용된다.
            keepOnSplit: false,
            parseHTML: (element: HTMLElement) =>
              normalizeNoteColorToken(
                element.getAttribute(NOTE_BLOCK_BACKGROUND_ATTRIBUTE),
              ),
            renderHTML: (attributes: Record<string, unknown>) => {
              const token = normalizeNoteColorToken(
                attributes[NOTE_BLOCK_BACKGROUND_ATTRIBUTE_NAME],
              );

              return token ? { [NOTE_BLOCK_BACKGROUND_ATTRIBUTE]: token } : {};
            },
          },
        },
      },
    ];
  },
  addStorage() {
    return {
      markdown: {
        parse: {
          updateDOM(element: HTMLElement) {
            hoistNoteBlockBackgroundMarkers(element);
          },
        },
      },
    };
  },
});

type MarkdownSerializerStorageType = {
  serializer?: {
    serialize: (content: Fragment) => string;
  };
};

// tiptap-markdown은 transformCopiedText 옵션으로 복사한 평문을 마크다운으로 직렬화한다.
// 그대로 두면 다른 편집기에 붙여넣을 때 색 문법이 그대로 노출되므로 먼저 걷어낸다.
const NoteColorClipboardText = Extension.create({
  name: "noteColorClipboardText",
  // tiptap-markdown(기본 priority 100)보다 먼저 clipboardTextSerializer를 제공해야 한다.
  priority: 200,
  addProseMirrorPlugins() {
    const { editor } = this;

    return [
      new Plugin({
        key: new PluginKey("noteColorClipboardText"),
        props: {
          clipboardTextSerializer: (slice) => {
            const storage = editor.storage as {
              markdown?: MarkdownSerializerStorageType;
            };
            const markdownSerializer = storage.markdown?.serializer;

            if (!markdownSerializer) {
              return slice.content.textBetween(0, slice.content.size, "\n\n");
            }

            return stripNoteColorSyntax(
              markdownSerializer.serialize(slice.content),
            );
          },
        },
      }),
    ];
  },
});

function getBaseExtensions({ readOnly = false }: { readOnly?: boolean } = {}) {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false,
      // 블록 핸들 드래그 시 표시되는 드롭 위치선.
      dropcursor: { width: 2, color: "var(--primary)" },
    }),
    ListItemBackspaceLift,
    BulletTaskItemInputRule,
    OrderedBulletItemInputRule,
    DividerInputRule,
    CodeBlockLowlight.extend({
      renderHTML({ node, HTMLAttributes }) {
        return [
          "pre",
          HTMLAttributes,
          [
            "code",
            {
              class: node.attrs.language
                ? `language-${node.attrs.language}`
                : null,
              "data-language": node.attrs.language || null,
            },
            0,
          ],
        ];
      },
    }).configure({ lowlight }),
    SafeImage.configure({
      allowBase64: false,
      HTMLAttributes: {
        class: "tiptap-image",
      },
    }),
    Link.configure({
      isAllowedUri: (url) => isSafeLinkHref(url),
      openOnClick: readOnly,
      HTMLAttributes: { class: "tiptap-link" },
    }),
    NoteTextColorMark,
    NoteLineTextColor,
    NoteBlockBackground,
    NoteColorClipboardText,
    TaskList,
    MarkdownTaskItem.configure({
      nested: true,
    }),
    MarkdownTable.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Markdown.configure({
      html: false,
      breaks: true,
      tightLists: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ];
}

export function getTipTapExtensions({
  placeholder,
}: { placeholder?: string | undefined } = {}) {
  return [
    ...getBaseExtensions(),
    SlashCommand.configure({
      suggestion: slashCommandSuggestionRender(),
    }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}

export function getReadOnlyTipTapExtensions() {
  return getBaseExtensions({ readOnly: true });
}
