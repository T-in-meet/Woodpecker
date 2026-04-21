import {
  Extension,
  InputRule,
  isAtStartOfNode,
  isNodeActive,
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
  type Node as ProseMirrorNode,
  type ResolvedPos,
} from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import go from "highlight.js/lib/languages/go";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import rust from "highlight.js/lib/languages/rust";
import typescript from "highlight.js/lib/languages/typescript";
import { createLowlight } from "lowlight";
import { Markdown } from "tiptap-markdown";

import { slashCommandSuggestionRender } from "../components/SlashCommandMenu";
import { isSafeLinkHref, normalizeImageSrc } from "./linkValidation";
import { SlashCommand } from "./slashCommand";

const lowlight = createLowlight();
lowlight.register("javascript", javascript);
lowlight.register("typescript", typescript);
lowlight.register("python", python);
lowlight.register("rust", rust);
lowlight.register("go", go);

const LIST_ITEM_TYPE_NAMES = ["listItem", "taskItem"] as const;
const TASK_MARKER_IN_BULLET_LIST_INPUT_REGEX = /^\[( |x|X)\]\s$/;

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

          const { $from } = state.selection;
          const listItemDepth = findAncestorDepth($from, listItemType.name);
          const listDepth = findAncestorDepth($from, bulletListType.name);

          if (listItemDepth === null || listDepth === null) {
            return null;
          }

          const itemIndex = $from.index(listDepth);
          const listNode = $from.node(listDepth);
          const listPosition = $from.before(listDepth);

          if (itemIndex < 0 || itemIndex >= listNode.childCount) {
            return null;
          }

          const tr = state.tr.delete(range.from, range.to);
          const mappedListPosition = tr.mapping.map(listPosition);
          const nextListNode = tr.doc.nodeAt(mappedListPosition);
          const nextListItemNode = nextListNode?.maybeChild(itemIndex);

          if (
            !nextListNode ||
            nextListNode.type !== bulletListType ||
            !nextListItemNode ||
            !taskItemType.validContent(nextListItemNode.content)
          ) {
            return null;
          }

          const taskItemNode = taskItemType.create(
            { checked: marker.toLowerCase() === "x" },
            nextListItemNode.content,
          );
          const taskListNode = taskListType.create(null, taskItemNode);
          const replacementNodes: ProseMirrorNode[] = [];
          let taskListPosition = mappedListPosition;

          if (itemIndex > 0) {
            const previousItems = Array.from(
              { length: itemIndex },
              (_, index) => nextListNode.child(index),
            );
            const previousListNode = bulletListType.create(
              nextListNode.attrs,
              previousItems,
            );

            replacementNodes.push(previousListNode);
            taskListPosition += previousListNode.nodeSize;
          }

          replacementNodes.push(taskListNode);

          if (itemIndex < nextListNode.childCount - 1) {
            replacementNodes.push(
              bulletListType.create(
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
          tr.setSelection(
            TextSelection.near(tr.doc.resolve(taskListPosition + 3)),
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

function getBaseExtensions({ readOnly = false }: { readOnly?: boolean } = {}) {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false,
    }),
    ListItemBackspaceLift,
    BulletTaskItemInputRule,
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
