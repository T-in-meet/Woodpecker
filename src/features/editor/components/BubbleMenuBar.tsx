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

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SUPPORTED_LANGUAGES } from "@/features/editor/supportedLanguages";
import { cn } from "@/lib/utils/cn";

import { LinkEditPopover } from "./LinkEditPopover";

type BubbleMenuBarProps = {
  editor: Editor;
  onDeleteBlock?: () => void;
};

export function BubbleMenuBar({ editor, onDeleteBlock }: BubbleMenuBarProps) {
  const [showLinkEdit, setShowLinkEdit] = useState(false);

  const handleLinkSubmit = useCallback(
    (url: string) => {
      if (url === "") {
        editor.chain().focus().unsetLink().run();
        setShowLinkEdit(false);
        return;
      }

      const chain = editor.chain().focus();

      if (editor.isActive("link")) {
        chain.extendMarkRange("link");
      } else if (editor.state.selection.empty) {
        // caret-only 상태에서는 link 마크를 입힐 텍스트 범위가 없어 시각적 변화가 없다.
        // 다른 mark 툴과 결을 맞추기 위해 cursor가 걸친 단어를 자동 선택한다.
        const { $from } = editor.state.selection;
        const text = $from.parent.textContent;
        const offset = $from.parentOffset;
        let start = offset;
        let end = offset;
        while (start > 0 && !/\s/.test(text[start - 1] ?? "")) start -= 1;
        while (end < text.length && !/\s/.test(text[end] ?? "")) end += 1;

        if (end > start) {
          const blockStart = $from.start();
          chain.setTextSelection({
            from: blockStart + start,
            to: blockStart + end,
          });
        }
      }

      chain.setLink({ href: url }).run();
      setShowLinkEdit(false);
    },
    [editor],
  );

  const isLink = editor.isActive("link");
  const isCodeBlock = editor.isActive("codeBlock");
  const isTable = editor.isActive("table");
  const codeBlockAttrs = editor.getAttributes("codeBlock");
  const codeBlockLanguage =
    typeof codeBlockAttrs.language === "string" ? codeBlockAttrs.language : "";

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
            aria-label="실행 취소"
            tooltipLabel="실행 취소"
          >
            <Undo2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            data-testid="toolbar-redo"
            aria-label="다시 실행"
            tooltipLabel="다시 실행"
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
            aria-label="제목 1"
            tooltipLabel="제목 1"
          >
            <Heading1 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            active={editor.isActive("heading", { level: 2 })}
            data-testid="toolbar-heading-2"
            aria-label="제목 2"
            tooltipLabel="제목 2"
          >
            <Heading2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            active={editor.isActive("heading", { level: 3 })}
            data-testid="toolbar-heading-3"
            aria-label="제목 3"
            tooltipLabel="제목 3"
          >
            <Heading3 className="size-3.5" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            data-testid="toolbar-bold"
            aria-label="굵게"
            tooltipLabel="굵게"
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            data-testid="toolbar-italic"
            aria-label="기울임"
            tooltipLabel="기울임"
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive("strike")}
            data-testid="toolbar-strike"
            aria-label="취소선"
            tooltipLabel="취소선"
          >
            <Strikethrough className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            active={editor.isActive("code")}
            data-testid="toolbar-inline-code"
            aria-label="인라인 코드"
            tooltipLabel="인라인 코드"
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
                aria-label="링크 편집"
                tooltipLabel="링크 편집"
              >
                <Link className="size-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().unsetLink().run()}
                data-testid="toolbar-remove-link"
                aria-label="링크 제거"
                tooltipLabel="링크 제거"
              >
                <Unlink className="size-3.5" />
              </ToolbarButton>
            </>
          ) : (
            <ToolbarButton
              onClick={() => setShowLinkEdit(true)}
              data-testid="toolbar-add-link"
              aria-label="링크 추가"
              tooltipLabel="링크 추가"
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
            aria-label="글머리 기호 목록"
            tooltipLabel="글머리 기호 목록"
          >
            <List className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            data-testid="toolbar-ordered-list"
            aria-label="번호 매기기 목록"
            tooltipLabel="번호 매기기 목록"
          >
            <ListOrdered className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            active={editor.isActive("taskList")}
            data-testid="toolbar-task-list"
            aria-label="체크박스 목록"
            tooltipLabel="체크박스 목록"
          >
            <ListChecks className="size-3.5" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive("blockquote")}
            data-testid="toolbar-blockquote"
            aria-label="인용문"
            tooltipLabel="인용문"
          >
            <TextQuote className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={isCodeBlock}
            data-testid="toolbar-code-block"
            aria-label="코드 블록"
            tooltipLabel="코드 블록"
          >
            <Code2 className="size-3.5" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            data-testid="toolbar-divider"
            aria-label="구분선"
            tooltipLabel="구분선"
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
            aria-label="표 삽입"
            tooltipLabel="표 삽입"
          >
            <Table className="size-3.5" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton
            onClick={onDeleteBlock}
            data-testid="toolbar-delete-block"
            aria-label="블록 삭제"
            tooltipLabel="블록 삭제"
          >
            <Trash2 className="size-3.5" />
          </ToolbarButton>

          {isTable && (
            <>
              <ToolbarButton
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                data-testid="toolbar-add-column"
                aria-label="열 추가"
                tooltipLabel="열 추가"
              >
                <Columns3 className="size-3.5" />
                <Plus className="size-2.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteColumn().run()}
                data-testid="toolbar-delete-column"
                aria-label="열 삭제"
                tooltipLabel="열 삭제"
              >
                <TableColumnsSplit className="size-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().addRowAfter().run()}
                data-testid="toolbar-add-row"
                aria-label="행 추가"
                tooltipLabel="행 추가"
              >
                <Rows3 className="size-3.5" />
                <Plus className="size-2.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteRow().run()}
                data-testid="toolbar-delete-row"
                aria-label="행 삭제"
                tooltipLabel="행 삭제"
              >
                <TableRowsSplit className="size-3.5" />
              </ToolbarButton>
              <ToolbarButton
                onClick={() => editor.chain().focus().deleteTable().run()}
                data-testid="toolbar-delete-table"
                aria-label="표 삭제"
                tooltipLabel="표 삭제"
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
            aria-label="코드 언어"
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

type ToolbarButtonProps = React.ComponentProps<"button"> & {
  active?: boolean;
  tooltipLabel: string;
};

function ToolbarButton({
  active,
  disabled,
  children,
  tooltipLabel,
  ...props
}: ToolbarButtonProps) {
  const buttonNode = (
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

  // Radix Tooltip은 disabled trigger의 pointer/focus 이벤트를 받지 못하므로
  // 비활성화 가능한 버튼은 포커서블 span으로 한 번 감싸 트리거를 이전한다.
  const trigger = disabled ? (
    <span tabIndex={0} className="inline-flex">
      {buttonNode}
    </span>
  ) : (
    buttonNode
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="left">{tooltipLabel}</TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <div className="my-0.5 h-px w-full bg-border" />;
}
