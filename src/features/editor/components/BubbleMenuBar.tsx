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

import { SUPPORTED_LANGUAGES } from "@/features/editor/supportedLanguages";
import { cn } from "@/lib/utils/cn";

import { LinkEditPopover } from "./LinkEditPopover";

type BubbleMenuBarProps = {
  editor: Editor;
};

export function BubbleMenuBar({ editor }: BubbleMenuBarProps) {
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
  const isCodeBlock = editor.isActive("codeBlock");
  const isTable = editor.isActive("table");
  const codeBlockLanguage =
    typeof editor.getAttributes("codeBlock").language === "string"
      ? editor.getAttributes("codeBlock").language
      : "";

  return showLinkEdit ? (
    <LinkEditPopover
      initialUrl={editor.getAttributes("link").href ?? ""}
      onSubmit={handleLinkSubmit}
      onCancel={() => setShowLinkEdit(false)}
    />
  ) : (
    <div
      data-testid="bubble-toolbar"
      className="bubble-menu flex max-w-[min(18rem,calc(100vw-2rem))] flex-col gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-md"
    >
      <div
        className="flex items-start gap-1"
        data-testid="bubble-toolbar-columns"
      >
        <ToolbarColumn data-testid="bubble-toolbar-column-primary">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            data-testid="toolbar-undo"
            aria-label="Undo"
          >
            <Undo2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            data-testid="toolbar-redo"
            aria-label="Redo"
          >
            <Redo2 className="size-3.5" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            active={editor.isActive("heading", { level: 1 })}
            data-testid="toolbar-heading-1"
            aria-label="Heading 1"
          >
            <Heading1 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            data-testid="toolbar-heading-2"
            aria-label="Heading 2"
          >
            <Heading2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            data-testid="toolbar-heading-3"
            aria-label="Heading 3"
          >
            <Heading3 className="size-3.5" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            data-testid="toolbar-bold"
            aria-label="Bold"
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            data-testid="toolbar-italic"
            aria-label="Italic"
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            data-testid="toolbar-strike"
            aria-label="Strikethrough"
          >
            <Strikethrough className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            data-testid="toolbar-inline-code"
            aria-label="Inline code"
          >
            <Code className="size-3.5" />
          </ToolbarButton>

          <Divider />

          {isLink ? (
            <>
              <ToolbarButton
                onClick={() => setShowLinkEdit(true)}
                active
                data-testid="toolbar-edit-link"
                aria-label="Edit link"
              >
                <Link className="size-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().unsetLink().run()}
                data-testid="toolbar-remove-link"
                aria-label="Remove link"
              >
                <Unlink className="size-3.5" />
              </ToolbarButton>
            </>
          ) : (
            <ToolbarButton
              onClick={() => setShowLinkEdit(true)}
              data-testid="toolbar-add-link"
              aria-label="Add link"
            >
              <Link className="size-3.5" />
            </ToolbarButton>
          )}
        </ToolbarColumn>

        <ToolbarColumn data-testid="bubble-toolbar-column-secondary">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            data-testid="toolbar-bullet-list"
            aria-label="Bullet list"
          >
            <List className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            data-testid="toolbar-ordered-list"
            aria-label="Ordered list"
          >
            <ListOrdered className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive("taskList")}
            data-testid="toolbar-task-list"
            aria-label="Task list"
          >
            <ListChecks className="size-3.5" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            data-testid="toolbar-blockquote"
            aria-label="Blockquote"
          >
            <TextQuote className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={isCodeBlock}
            data-testid="toolbar-code-block"
            aria-label="Code block"
          >
            <Code2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            data-testid="toolbar-divider"
            aria-label="Divider"
          >
            <Minus className="size-3.5" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
            data-testid="toolbar-insert-table"
            aria-label="Insert table"
          >
            <Table className="size-3.5" />
          </ToolbarButton>

          {isTable && (
            <>
              <ToolbarButton
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                data-testid="toolbar-add-column"
                aria-label="Add column"
                title="Add column"
              >
                <Columns3 className="size-3.5" />
                <Plus className="size-2.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteColumn().run()}
                data-testid="toolbar-delete-column"
                aria-label="Delete column"
                title="Delete column"
              >
                <TableColumnsSplit className="size-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().addRowAfter().run()}
                data-testid="toolbar-add-row"
                aria-label="Add row"
                title="Add row"
              >
                <Rows3 className="size-3.5" />
                <Plus className="size-2.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteRow().run()}
                data-testid="toolbar-delete-row"
                aria-label="Delete row"
                title="Delete row"
              >
                <TableRowsSplit className="size-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteTable().run()}
                data-testid="toolbar-delete-table"
                aria-label="Delete table"
                title="Delete table"
              >
                <Trash2 className="size-3.5" />
              </ToolbarButton>
            </>
          )}
        </ToolbarColumn>
      </div>

      {isCodeBlock && (
        <div
          className="border-t border-border/70 pt-1"
          data-testid="toolbar-code-language-panel"
        >
          <label
            htmlFor="toolbar-code-language"
            className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
          >
            Code language
          </label>
          <select
            id="toolbar-code-language"
            data-testid="toolbar-code-language"
            value={codeBlockLanguage}
            onChange={(event) => {
              const nextLanguage = event.target.value;

              editor
                .chain()
                .focus()
                .updateAttributes("codeBlock", {
                  language: nextLanguage === "" ? null : nextLanguage,
                })
                .run();
            }}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
            aria-label="Code language"
          >
            <option value="">Plain text</option>
            {SUPPORTED_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function ToolbarColumn(props: React.ComponentProps<"div">) {
  const { className, ...restProps } = props;

  return (
    <div
      className={cn("flex min-w-0 flex-col items-center gap-0.5", className)}
      {...restProps}
    />
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
        "inline-flex size-6 items-center justify-center rounded-md transition-colors",
        "hover:bg-muted/90",
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
  return <div className="my-0.5 h-px w-full bg-border" />;
}
