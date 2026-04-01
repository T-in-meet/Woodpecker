"use client";

import type { Editor } from "@tiptap/react";
import {
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
  Minus,
  Plus,
  Redo2,
  Rows3,
  Strikethrough,
  Table,
  TableColumnsSplit,
  TableRowsSplit,
  TextQuote,
  Trash2,
  Undo2,
  Unlink,
} from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils/cn";

import { LinkEditPopover } from "./LinkEditPopover";

type FixedToolbarProps = {
  editor: Editor;
};

export function FixedToolbar({ editor }: FixedToolbarProps) {
  const [showLinkEdit, setShowLinkEdit] = useState(false);

  const handleLinkSubmit = useCallback(
    (url: string) => {
      if (url === "") {
        editor.chain().focus().unsetLink().run();
      } else {
        editor.chain().focus().setLink({ href: url }).run();
      }
      setShowLinkEdit(false);
    },
    [editor],
  );

  const isLink = editor.isActive("link");

  return (
    <div className="relative flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1">
      {/* Undo / Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        aria-label="실행 취소"
      >
        <Undo2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        aria-label="다시 실행"
      >
        <Redo2 className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* Headings */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive("heading", { level: 1 })}
        aria-label="제목 1"
      >
        <Heading1 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        aria-label="제목 2"
      >
        <Heading2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        aria-label="제목 3"
      >
        <Heading3 className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* Inline formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        aria-label="굵게"
      >
        <Bold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        aria-label="기울임"
      >
        <Italic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        aria-label="취소선"
      >
        <Strikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive("code")}
        aria-label="인라인 코드"
      >
        <Code className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        aria-label="글머리 기호 목록"
      >
        <List className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive("orderedList")}
        aria-label="번호 목록"
      >
        <ListOrdered className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive("taskList")}
        aria-label="체크리스트"
      >
        <ListChecks className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        aria-label="인용문"
      >
        <TextQuote className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive("codeBlock")}
        aria-label="코드 블록"
      >
        <Code2 className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        aria-label="구분선"
      >
        <Minus className="size-4" />
      </ToolbarButton>

      <Divider />

      {/* Table */}
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        aria-label="표 삽입"
      >
        <Table className="size-4" />
      </ToolbarButton>

      {editor.isActive("table") && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            aria-label="오른쪽에 열 추가"
            title="열 추가"
          >
            <Columns3 className="size-4" />
            <Plus className="size-2.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            aria-label="열 삭제"
            title="열 삭제"
          >
            <TableColumnsSplit className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            aria-label="아래에 행 추가"
            title="행 추가"
          >
            <Rows3 className="size-4" />
            <Plus className="size-2.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            aria-label="행 삭제"
            title="행 삭제"
          >
            <TableRowsSplit className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            aria-label="표 삭제"
            title="표 삭제"
          >
            <Trash2 className="size-4" />
          </ToolbarButton>
        </>
      )}

      <Divider />

      {/* Link */}
      {isLink ? (
        <>
          <ToolbarButton
            onClick={() => setShowLinkEdit(true)}
            active
            aria-label="링크 편집"
          >
            <Link className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().unsetLink().run()}
            aria-label="링크 제거"
          >
            <Unlink className="size-4" />
          </ToolbarButton>
        </>
      ) : (
        <ToolbarButton
          onClick={() => setShowLinkEdit(true)}
          aria-label="링크 추가"
        >
          <Link className="size-4" />
        </ToolbarButton>
      )}

      {showLinkEdit && (
        <div className="absolute left-0 top-full z-10 mt-1">
          <LinkEditPopover
            initialUrl={editor.getAttributes("link").href ?? ""}
            onSubmit={handleLinkSubmit}
            onCancel={() => setShowLinkEdit(false)}
          />
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  active,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors",
        "hover:bg-muted",
        "disabled:pointer-events-none disabled:opacity-40",
        active && "bg-muted text-foreground",
        !active && "text-muted-foreground",
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}
