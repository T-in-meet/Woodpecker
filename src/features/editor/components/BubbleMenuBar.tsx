"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code, Italic, Link, Strikethrough, Unlink } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils/cn";

import { LinkEditPopover } from "./LinkEditPopover";

type BubbleMenuBarProps = {
  editor: Editor;
};

export function BubbleMenuBar({ editor }: BubbleMenuBarProps) {
  const [showLinkEdit, setShowLinkEdit] = useState(false);

  const toggleBold = useCallback(
    () => editor.chain().focus().toggleBold().run(),
    [editor],
  );
  const toggleItalic = useCallback(
    () => editor.chain().focus().toggleItalic().run(),
    [editor],
  );
  const toggleStrike = useCallback(
    () => editor.chain().focus().toggleStrike().run(),
    [editor],
  );
  const toggleCode = useCallback(
    () => editor.chain().focus().toggleCode().run(),
    [editor],
  );
  const removeLink = useCallback(
    () => editor.chain().focus().unsetLink().run(),
    [editor],
  );

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
    <BubbleMenu
      editor={editor}
      shouldShow={({
        editor: e,
        state,
      }: {
        editor: Editor;
        state: { selection: { empty: boolean } };
      }) => {
        if (state.selection.empty) return false;
        if (e.isActive("codeBlock")) return false;
        return true;
      }}
    >
      {showLinkEdit ? (
        <LinkEditPopover
          initialUrl={editor.getAttributes("link").href ?? ""}
          onSubmit={handleLinkSubmit}
          onCancel={() => setShowLinkEdit(false)}
        />
      ) : (
        <div className="bubble-menu flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md">
          <ToolbarButton
            onClick={toggleBold}
            active={editor.isActive("bold")}
            aria-label="굵게"
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={toggleItalic}
            active={editor.isActive("italic")}
            aria-label="기울임"
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={toggleStrike}
            active={editor.isActive("strike")}
            aria-label="취소선"
          >
            <Strikethrough className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={toggleCode}
            active={editor.isActive("code")}
            aria-label="인라인 코드"
          >
            <Code className="size-4" />
          </ToolbarButton>

          <div className="mx-0.5 h-5 w-px bg-border" />

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
                onClick={removeLink}
                active={false}
                aria-label="링크 제거"
              >
                <Unlink className="size-4" />
              </ToolbarButton>
            </>
          ) : (
            <ToolbarButton
              onClick={() => setShowLinkEdit(true)}
              active={false}
              aria-label="링크 추가"
            >
              <Link className="size-4" />
            </ToolbarButton>
          )}
        </div>
      )}
    </BubbleMenu>
  );
}

function ToolbarButton({
  active,
  children,
  ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors",
        "hover:bg-muted",
        active && "bg-muted text-foreground",
        !active && "text-muted-foreground",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
