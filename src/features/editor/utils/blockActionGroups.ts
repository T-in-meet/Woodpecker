import type { Editor } from "@tiptap/react";
import {
  ArrowDown,
  ArrowUp,
  Baseline,
  Bold,
  Code,
  Code2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Minus,
  Redo2,
  Rows3,
  Strikethrough,
  Table,
  TableColumnsSplit,
  TableRowsSplit,
  TextQuote,
  Trash2,
  Type,
  Undo2,
  Unlink,
} from "lucide-react";

import {
  normalizeNoteColorToken,
  NOTE_COLOR_DEFAULT_LABEL,
  NOTE_COLOR_LABELS,
  NOTE_COLOR_TOKENS,
  type NoteColorTokenType,
} from "../noteColors";
import { SUPPORTED_LANGUAGES } from "../supportedLanguages";
import {
  type BlockMoveDirectionType,
  canMoveSelectedBlock,
  insertHorizontalRule,
  moveSelectedBlock,
} from "./blockActions";
import {
  applyNoteBlockBackground,
  getSelectedNoteBlockBackground,
} from "./noteBlockBackground";
import { NOTE_TEXT_COLOR_MARK_NAME } from "./noteColorMarkdown";

// 글자색은 선택한 문자에, 배경색은 블록 전체에 적용된다.
export type NoteColorKindType = "color" | "background";

export type NoteColorSwatchType = {
  kind: NoteColorKindType;
  token: NoteColorTokenType | null;
};

export type BlockActionType = {
  id: string;
  label: string;
  // 색상 항목은 아이콘 대신 색 견본(swatch)을 보여준다.
  icon?: LucideIcon;
  swatch?: NoteColorSwatchType;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  // true면 실행 후에도 메뉴를 닫지 않는다 (링크 편집처럼 후속 입력이 필요한 경우).
  keepOpen?: boolean;
  run: () => void;
};

export type BlockActionGroupType = {
  id: string;
  label: string;
  icon: LucideIcon;
  // submenu가 false면 항목을 메뉴 본문에 그대로 펼친다.
  submenu: boolean;
  actions: BlockActionType[];
};

export function buildNoteColorActions(
  editor: Editor,
  kind: NoteColorKindType,
): BlockActionType[] {
  const currentToken =
    kind === "background"
      ? getSelectedNoteBlockBackground(editor)
      : normalizeNoteColorToken(
          editor.getAttributes(NOTE_TEXT_COLOR_MARK_NAME).token,
        );

  const applyToken = (token: NoteColorTokenType | null) => {
    if (kind === "background") {
      applyNoteBlockBackground(editor, token);
      return;
    }

    const chain = editor.chain().focus();

    if (token === null) {
      chain.unsetMark(NOTE_TEXT_COLOR_MARK_NAME).run();
      return;
    }

    chain.setMark(NOTE_TEXT_COLOR_MARK_NAME, { token }).run();
  };

  return [
    {
      id: `note-${kind}-default`,
      label: NOTE_COLOR_DEFAULT_LABEL,
      swatch: { kind, token: null },
      active: currentToken === null,
      run: () => applyToken(null),
    },
    ...NOTE_COLOR_TOKENS.map(
      (token) =>
        ({
          id: `note-${kind}-${token}`,
          label: NOTE_COLOR_LABELS[token],
          swatch: { kind, token },
          active: currentToken === token,
          run: () => applyToken(token),
        }) satisfies BlockActionType,
    ),
  ];
}

// 선택 영역 기반 인라인 툴바와 블록 메뉴가 같은 서식 항목을 쓰도록 공유한다.
export type BuildInlineFormatActionsOptions = {
  editor: Editor;
  onEditLink: () => void;
};

export function buildInlineFormatActions({
  editor,
  onEditLink,
}: BuildInlineFormatActionsOptions): BlockActionType[] {
  const isLink = editor.isActive("link");

  return [
    {
      id: "bold",
      label: "굵게",
      icon: Bold,
      shortcut: "Ctrl+B",
      active: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: "기울임",
      icon: Italic,
      shortcut: "Ctrl+I",
      active: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      id: "strike",
      label: "취소선",
      icon: Strikethrough,
      active: editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      id: "inline-code",
      label: "인라인 코드",
      icon: Code,
      active: editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
    {
      id: "link",
      label: isLink ? "링크 편집" : "링크 추가",
      icon: Link,
      active: isLink,
      keepOpen: true,
      run: onEditLink,
    },
    ...(isLink
      ? [
          {
            id: "unlink",
            label: "링크 제거",
            icon: Unlink,
            run: () => editor.chain().focus().unsetLink().run(),
          } satisfies BlockActionType,
        ]
      : []),
  ];
}

export type BuildBlockActionGroupsOptions = {
  editor: Editor;
  onDeleteBlock: () => void;
  onEditLink: () => void;
};

export function buildBlockActionGroups({
  editor,
  onDeleteBlock,
  onEditLink,
}: BuildBlockActionGroupsOptions): BlockActionGroupType[] {
  const isCodeBlock = editor.isActive("codeBlock");
  const isTable = editor.isActive("table");
  const codeBlockAttributes = editor.getAttributes("codeBlock");
  const codeBlockLanguage =
    typeof codeBlockAttributes.language === "string"
      ? codeBlockAttributes.language
      : "";

  const groups: BlockActionGroupType[] = [
    {
      id: "turn-into",
      label: "유형 변경",
      icon: Type,
      submenu: true,
      actions: [
        {
          id: "paragraph",
          label: "본문",
          icon: Type,
          active: editor.isActive("paragraph"),
          run: () => editor.chain().focus().setParagraph().run(),
        },
        {
          id: "heading-1",
          label: "제목 1",
          icon: Heading1,
          active: editor.isActive("heading", { level: 1 }),
          run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          id: "heading-2",
          label: "제목 2",
          icon: Heading2,
          active: editor.isActive("heading", { level: 2 }),
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          id: "heading-3",
          label: "제목 3",
          icon: Heading3,
          active: editor.isActive("heading", { level: 3 }),
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          id: "bullet-list",
          label: "글머리 기호 목록",
          icon: List,
          active: editor.isActive("bulletList"),
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          id: "ordered-list",
          label: "번호 매기기 목록",
          icon: ListOrdered,
          active: editor.isActive("orderedList"),
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          id: "task-list",
          label: "체크박스 목록",
          icon: ListChecks,
          active: editor.isActive("taskList"),
          run: () => editor.chain().focus().toggleTaskList().run(),
        },
        {
          id: "blockquote",
          label: "인용문",
          icon: TextQuote,
          active: editor.isActive("blockquote"),
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          id: "code-block",
          label: "코드 블록",
          icon: Code2,
          active: isCodeBlock,
          run: () => editor.chain().focus().toggleCodeBlock().run(),
        },
      ],
    },
    {
      id: "format",
      label: "서식",
      icon: Bold,
      submenu: true,
      actions: buildInlineFormatActions({ editor, onEditLink }),
    },
    {
      id: "text-color",
      label: "글자 색",
      icon: Baseline,
      submenu: true,
      actions: buildNoteColorActions(editor, "color"),
    },
    {
      id: "background-color",
      label: "배경 색",
      icon: Highlighter,
      submenu: true,
      actions: buildNoteColorActions(editor, "background"),
    },
    {
      id: "insert",
      label: "삽입",
      icon: Table,
      submenu: true,
      actions: [
        {
          id: "divider",
          label: "구분선",
          icon: Minus,
          run: () => insertHorizontalRule(editor),
        },
        {
          id: "table",
          label: "표 삽입",
          icon: Table,
          run: () =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run(),
        },
      ],
    },
  ];

  if (isCodeBlock) {
    groups.push({
      id: "code-language",
      label: "코드 언어",
      icon: Code2,
      submenu: true,
      actions: [
        {
          id: "language-plain",
          label: "Plain text",
          icon: Code2,
          active: codeBlockLanguage === "",
          run: () =>
            editor
              .chain()
              .focus()
              .updateAttributes("codeBlock", { language: null })
              .run(),
        },
        ...SUPPORTED_LANGUAGES.map(
          (language) =>
            ({
              id: `language-${language}`,
              label: language,
              icon: Code2,
              active: codeBlockLanguage === language,
              run: () =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("codeBlock", { language })
                  .run(),
            }) satisfies BlockActionType,
        ),
      ],
    });
  }

  if (isTable) {
    groups.push({
      id: "table-edit",
      label: "표 편집",
      icon: Table,
      submenu: true,
      actions: [
        {
          id: "add-column",
          label: "열 추가",
          icon: Columns3,
          run: () => editor.chain().focus().addColumnAfter().run(),
        },
        {
          id: "delete-column",
          label: "열 삭제",
          icon: TableColumnsSplit,
          run: () => editor.chain().focus().deleteColumn().run(),
        },
        {
          id: "add-row",
          label: "행 추가",
          icon: Rows3,
          run: () => editor.chain().focus().addRowAfter().run(),
        },
        {
          id: "delete-row",
          label: "행 삭제",
          icon: TableRowsSplit,
          run: () => editor.chain().focus().deleteRow().run(),
        },
        {
          id: "delete-table",
          label: "표 삭제",
          icon: Trash2,
          destructive: true,
          run: () => editor.chain().focus().deleteTable().run(),
        },
      ],
    });
  }

  groups.push({
    id: "block",
    label: "블록",
    icon: ArrowUp,
    submenu: false,
    actions: [
      {
        id: "move-up",
        label: "위로 이동",
        icon: ArrowUp,
        disabled: !canMoveSelectedBlock(editor, "up"),
        run: () => moveBlock(editor, "up"),
      },
      {
        id: "move-down",
        label: "아래로 이동",
        icon: ArrowDown,
        disabled: !canMoveSelectedBlock(editor, "down"),
        run: () => moveBlock(editor, "down"),
      },
      {
        id: "delete-block",
        label: "블록 삭제",
        icon: Trash2,
        shortcut: "Del",
        destructive: true,
        run: onDeleteBlock,
      },
    ],
  });

  groups.push({
    id: "history",
    label: "기록",
    icon: Undo2,
    submenu: false,
    actions: [
      {
        id: "undo",
        label: "실행 취소",
        icon: Undo2,
        shortcut: "Ctrl+Z",
        disabled: !editor.can().undo(),
        run: () => editor.chain().focus().undo().run(),
      },
      {
        id: "redo",
        label: "다시 실행",
        icon: Redo2,
        shortcut: "Ctrl+Y",
        disabled: !editor.can().redo(),
        run: () => editor.chain().focus().redo().run(),
      },
    ],
  });

  return groups;
}

function moveBlock(editor: Editor, direction: BlockMoveDirectionType) {
  moveSelectedBlock(editor, direction);
}
