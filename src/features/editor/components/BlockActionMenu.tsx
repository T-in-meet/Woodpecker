"use client";

import type { Editor } from "@tiptap/react";
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Code,
  Code2,
  Columns3,
  Heading1,
  Heading2,
  Heading3,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_LANGUAGES } from "@/features/editor/supportedLanguages";
import {
  type BlockMoveDirectionType,
  canMoveSelectedBlock,
  moveSelectedBlock,
} from "@/features/editor/utils/blockActions";

import { LinkEditPopover } from "./LinkEditPopover";

type BlockActionType = {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: string;
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
  const [query, setQuery] = useState("");
  const [showLinkEdit, setShowLinkEdit] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Radix 메뉴는 열릴 때 첫 항목으로 포커스를 옮긴다. 노션처럼 바로 검색할 수 있도록
  // 다음 프레임에 검색창으로 포커스를 되가져온다.
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => cancelAnimationFrame(frameId);
  }, []);

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

  const groups = useMemo(
    () =>
      buildBlockActionGroups({
        editor,
        onDeleteBlock,
        onEditLink: () => setShowLinkEdit(true),
      }),
    [editor, onDeleteBlock],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedQuery) {
      return [];
    }

    return groups
      .flatMap((group) =>
        group.actions.map((action) => ({ group, action }) as const),
      )
      .filter(
        ({ group, action }) =>
          action.label.toLowerCase().includes(normalizedQuery) ||
          action.keywords.toLowerCase().includes(normalizedQuery) ||
          group.label.toLowerCase().includes(normalizedQuery),
      );
  }, [groups, normalizedQuery]);

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
      onCloseAutoFocus={(event) => {
        // Radix 기본 동작은 트리거(핸들 버튼)로 포커스를 되돌리는데, 그러면 블록이
        // 선택된 상태여도 Ctrl+C가 에디터에 닿지 않는다.
        event.preventDefault();

        if (!editor.isDestroyed) {
          editor.view.focus();
        }
      }}
    >
      <div className="px-1 pt-0.5 pb-1.5">
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          // 메뉴의 타이핑 탐색 기능이 입력을 가로채지 않도록 막는다.
          onKeyDown={(event) => {
            if (event.key !== "Escape") {
              event.stopPropagation();
            }
          }}
          placeholder="작업 검색..."
          aria-label="작업 검색"
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring"
        />
      </div>

      {normalizedQuery ? (
        searchResults.length > 0 ? (
          searchResults.map(({ group, action }) => (
            <BlockActionMenuItem
              key={`${group.id}-${action.id}`}
              action={action}
              hint={group.label}
            />
          ))
        ) : (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            검색 결과가 없습니다
          </p>
        )
      ) : (
        groups.map((group, groupIndex) => (
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
        ))
      )}
    </DropdownMenuContent>
  );
}

type BlockActionMenuItemProps = {
  action: BlockActionType;
  hint?: string;
};

function BlockActionMenuItem({ action, hint }: BlockActionMenuItemProps) {
  const { icon: Icon } = action;

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
      <Icon />
      <span className="flex-1 truncate">{action.label}</span>
      {hint && (
        <span className="text-[10px] text-muted-foreground">{hint}</span>
      )}
      {action.shortcut && (
        <DropdownMenuShortcut>{action.shortcut}</DropdownMenuShortcut>
      )}
    </DropdownMenuItem>
  );
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
          keywords: "paragraph text 본문 문단",
          active: editor.isActive("paragraph"),
          run: () => editor.chain().focus().setParagraph().run(),
        },
        {
          id: "heading-1",
          label: "제목 1",
          icon: Heading1,
          keywords: "heading h1 제목",
          active: editor.isActive("heading", { level: 1 }),
          run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        },
        {
          id: "heading-2",
          label: "제목 2",
          icon: Heading2,
          keywords: "heading h2 제목",
          active: editor.isActive("heading", { level: 2 }),
          run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        },
        {
          id: "heading-3",
          label: "제목 3",
          icon: Heading3,
          keywords: "heading h3 제목",
          active: editor.isActive("heading", { level: 3 }),
          run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        },
        {
          id: "bullet-list",
          label: "글머리 기호 목록",
          icon: List,
          keywords: "bullet list 목록 리스트",
          active: editor.isActive("bulletList"),
          run: () => editor.chain().focus().toggleBulletList().run(),
        },
        {
          id: "ordered-list",
          label: "번호 매기기 목록",
          icon: ListOrdered,
          keywords: "ordered number list 번호 목록",
          active: editor.isActive("orderedList"),
          run: () => editor.chain().focus().toggleOrderedList().run(),
        },
        {
          id: "task-list",
          label: "체크박스 목록",
          icon: ListChecks,
          keywords: "task todo check 체크 할일",
          active: editor.isActive("taskList"),
          run: () => editor.chain().focus().toggleTaskList().run(),
        },
        {
          id: "blockquote",
          label: "인용문",
          icon: TextQuote,
          keywords: "quote blockquote 인용",
          active: editor.isActive("blockquote"),
          run: () => editor.chain().focus().toggleBlockquote().run(),
        },
        {
          id: "code-block",
          label: "코드 블록",
          icon: Code2,
          keywords: "code block 코드",
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
          keywords: "bold strong 굵게",
          shortcut: "Ctrl+B",
          active: editor.isActive("bold"),
          run: () => editor.chain().focus().toggleBold().run(),
        },
        {
          id: "italic",
          label: "기울임",
          icon: Italic,
          keywords: "italic 기울임",
          shortcut: "Ctrl+I",
          active: editor.isActive("italic"),
          run: () => editor.chain().focus().toggleItalic().run(),
        },
        {
          id: "strike",
          label: "취소선",
          icon: Strikethrough,
          keywords: "strike 취소선",
          active: editor.isActive("strike"),
          run: () => editor.chain().focus().toggleStrike().run(),
        },
        {
          id: "inline-code",
          label: "인라인 코드",
          icon: Code,
          keywords: "inline code 코드",
          active: editor.isActive("code"),
          run: () => editor.chain().focus().toggleCode().run(),
        },
        {
          id: "link",
          label: isLink ? "링크 편집" : "링크 추가",
          icon: Link,
          keywords: "link url 링크",
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
                keywords: "unlink 링크 제거",
                run: () => editor.chain().focus().unsetLink().run(),
              } satisfies BlockActionType,
            ]
          : []),
      ],
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
          keywords: "divider hr 구분선",
          run: () => editor.chain().focus().setHorizontalRule().run(),
        },
        {
          id: "table",
          label: "표 삽입",
          icon: Table,
          keywords: "table 표",
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
          keywords: "plain text 코드 언어",
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
              keywords: `${language} 코드 언어`,
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
          keywords: "column add 열 추가",
          run: () => editor.chain().focus().addColumnAfter().run(),
        },
        {
          id: "delete-column",
          label: "열 삭제",
          icon: TableColumnsSplit,
          keywords: "column delete 열 삭제",
          run: () => editor.chain().focus().deleteColumn().run(),
        },
        {
          id: "add-row",
          label: "행 추가",
          icon: Rows3,
          keywords: "row add 행 추가",
          run: () => editor.chain().focus().addRowAfter().run(),
        },
        {
          id: "delete-row",
          label: "행 삭제",
          icon: TableRowsSplit,
          keywords: "row delete 행 삭제",
          run: () => editor.chain().focus().deleteRow().run(),
        },
        {
          id: "delete-table",
          label: "표 삭제",
          icon: Trash2,
          keywords: "table delete 표 삭제",
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
        keywords: "move up 위로 이동",
        disabled: !canMoveSelectedBlock(editor, "up"),
        run: () => moveBlock(editor, "up"),
      },
      {
        id: "move-down",
        label: "아래로 이동",
        icon: ArrowDown,
        keywords: "move down 아래로 이동",
        disabled: !canMoveSelectedBlock(editor, "down"),
        run: () => moveBlock(editor, "down"),
      },
      {
        id: "delete-block",
        label: "블록 삭제",
        icon: Trash2,
        keywords: "delete remove 삭제",
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
        keywords: "undo 실행 취소",
        shortcut: "Ctrl+Z",
        disabled: !editor.can().undo(),
        run: () => editor.chain().focus().undo().run(),
      },
      {
        id: "redo",
        label: "다시 실행",
        icon: Redo2,
        keywords: "redo 다시 실행",
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
