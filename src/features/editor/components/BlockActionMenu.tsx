"use client";

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
import { useCallback, useMemo, useState } from "react";

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  normalizeNoteColorToken,
  NOTE_COLOR_DEFAULT_LABEL,
  NOTE_COLOR_LABELS,
  NOTE_COLOR_TOKENS,
  type NoteColorTokenType,
} from "@/features/editor/noteColors";
import { SUPPORTED_LANGUAGES } from "@/features/editor/supportedLanguages";
import {
  type BlockMoveDirectionType,
  canMoveSelectedBlock,
  insertHorizontalRule,
  moveSelectedBlock,
} from "@/features/editor/utils/blockActions";
import {
  applyNoteBlockBackground,
  getSelectedNoteBlockBackground,
} from "@/features/editor/utils/noteBlockBackground";
import { NOTE_TEXT_COLOR_MARK_NAME } from "@/features/editor/utils/noteColorMarkdown";

import { LinkEditPopover } from "./LinkEditPopover";

// 글자색은 선택한 문자에, 배경색은 블록 전체에 적용된다.
type NoteColorKindType = "color" | "background";

type NoteColorSwatchType = {
  kind: NoteColorKindType;
  token: NoteColorTokenType | null;
};

type BlockActionType = {
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

type BlockActionGroupType = {
  id: string;
  label: string;
  icon: LucideIcon;
  // submenu가 false면 항목을 메뉴 본문에 그대로 펼친다.
  submenu: boolean;
  actions: BlockActionType[];
};

type BlockActionMenuProps = {
  editor: Editor;
  onDeleteBlock: () => void;
  onCloseMenu: () => void;
};

export function BlockActionMenu({
  editor,
  onDeleteBlock,
  onCloseMenu,
}: BlockActionMenuProps) {
  const [showLinkEdit, setShowLinkEdit] = useState(false);

  const handleLinkSubmit = useCallback(
    (url: string) => {
      const chain = editor.chain().focus();

      if (url === "") {
        chain.unsetLink().run();
      } else {
        if (editor.isActive("link")) {
          chain.extendMarkRange("link");
        }

        chain.setLink({ href: url }).run();
      }

      setShowLinkEdit(false);
      onCloseMenu();
    },
    [editor, onCloseMenu],
  );

  // 메뉴가 열린 상태에서 Del/Backspace로 바로 블록을 지운다.
  const handleDeleteShortcut = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      event.preventDefault();
      onDeleteBlock();
    },
    [onDeleteBlock],
  );

  const groups = useMemo(
    () =>
      buildBlockActionGroups({
        editor,
        onDeleteBlock,
        onEditLink: () => setShowLinkEdit(true),
      }),
    [editor, onDeleteBlock],
  );

  if (showLinkEdit) {
    return (
      <DropdownMenuContent
        align="start"
        side="left"
        sideOffset={8}
        className="w-64 p-0"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <LinkEditPopover
          initialUrl={editor.getAttributes("link").href ?? ""}
          onSubmit={handleLinkSubmit}
          onCancel={() => setShowLinkEdit(false)}
        />
      </DropdownMenuContent>
    );
  }

  return (
    <DropdownMenuContent
      align="start"
      side="left"
      sideOffset={8}
      className="w-64"
      onKeyDown={handleDeleteShortcut}
      onCloseAutoFocus={(event) => {
        // Radix 기본 동작은 트리거(핸들 버튼)로 포커스를 되돌리는데, 그러면 블록이
        // 선택된 상태여도 Ctrl+C가 에디터에 닿지 않는다.
        event.preventDefault();

        if (!editor.isDestroyed) {
          editor.view.focus();
        }
      }}
    >
      {groups.map((group, groupIndex) => (
        <div key={group.id}>
          {groupIndex > 0 && <DropdownMenuSeparator />}
          {group.submenu ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="cursor-pointer">
                <group.icon />
                {group.label}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {group.actions.map((action) => (
                  <BlockActionMenuItem key={action.id} action={action} />
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            group.actions.map((action) => (
              <BlockActionMenuItem key={action.id} action={action} />
            ))
          )}
        </div>
      ))}
    </DropdownMenuContent>
  );
}

type BlockActionMenuItemProps = {
  action: BlockActionType;
};

function BlockActionMenuItem({ action }: BlockActionMenuItemProps) {
  const { icon: Icon, swatch } = action;

  return (
    <DropdownMenuItem
      className="cursor-pointer"
      disabled={action.disabled ?? false}
      variant={action.destructive ? "destructive" : "default"}
      data-active={action.active ? "true" : undefined}
      onSelect={(event) => {
        if (action.keepOpen) {
          event.preventDefault();
        }

        action.run();
      }}
    >
      {swatch ? <NoteColorSwatch swatch={swatch} /> : Icon ? <Icon /> : null}
      <span className="flex-1 truncate">{action.label}</span>
      {action.shortcut && (
        <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
      )}
    </DropdownMenuItem>
  );
}

type NoteColorSwatchProps = {
  swatch: NoteColorSwatchType;
};

function NoteColorSwatch({ swatch }: NoteColorSwatchProps) {
  const { kind, token } = swatch;

  // "기본"은 색이 없는 상태라 테두리만 있는 빈 견본으로 보여준다.
  const style =
    token === null
      ? undefined
      : kind === "color"
        ? { color: `var(--note-text-${token})` }
        : { backgroundColor: `var(--note-bg-${token})` };

  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-[0.25rem] border border-border text-[0.625rem] font-semibold"
      style={style}
    >
      가
    </span>
  );
}

function buildNoteColorActions(
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

type BuildBlockActionGroupsOptions = {
  editor: Editor;
  onDeleteBlock: () => void;
  onEditLink: () => void;
};

function buildBlockActionGroups({
  editor,
  onDeleteBlock,
  onEditLink,
}: BuildBlockActionGroupsOptions): BlockActionGroupType[] {
  const isCodeBlock = editor.isActive("codeBlock");
  const isTable = editor.isActive("table");
  const isLink = editor.isActive("link");
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
      actions: [
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
      ],
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
