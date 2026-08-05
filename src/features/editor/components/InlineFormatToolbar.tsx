"use client";

import { TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Baseline, ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils/cn";

import {
  type BlockActionType,
  buildInlineFormatActions,
  buildNoteColorActions,
} from "../utils/blockActionGroups";
import { LinkEditPopover } from "./LinkEditPopover";
import { NoteColorSwatch } from "./NoteColorSwatch";

type ToolbarViewType = "format" | "link" | "color";

export type ShouldShowInlineFormatToolbarOptions = {
  editor: Editor;
  isBlockMenuOpen: boolean;
  hasEditorFocus: boolean;
  from: number;
  to: number;
};

export function shouldShowInlineFormatToolbar({
  editor,
  isBlockMenuOpen,
  hasEditorFocus,
  from,
  to,
}: ShouldShowInlineFormatToolbarOptions): boolean {
  if (isBlockMenuOpen) return false;
  if (!editor.isEditable) return false;

  const { selection, doc } = editor.state;

  // 블록 핸들 메뉴는 대상 블록에 NodeSelection을 건다. 그 선택은 인라인 서식 대상이 아니다.
  if (!(selection instanceof TextSelection)) return false;
  if (selection.empty) return false;
  // 빈 문단을 더블클릭하면 크기가 2인 선택이 잡히므로 실제 텍스트가 있는지도 본다.
  if (doc.textBetween(from, to).length === 0) return false;
  // 코드 블록 안에서는 인라인 마크를 쓰지 않는다.
  if (editor.isActive("codeBlock")) return false;

  return hasEditorFocus;
}

type InlineFormatToolbarProps = {
  editor: Editor;
  // 블록 핸들 메뉴가 열려 있으면 두 메뉴가 동시에 뜨므로 인라인 툴바를 감춘다.
  isBlockMenuOpen: boolean;
};

export function InlineFormatToolbar({
  editor,
  isBlockMenuOpen,
}: InlineFormatToolbarProps) {
  const shouldShow = useCallback(
    ({
      element,
      view: editorView,
      from,
      to,
    }: {
      element: HTMLElement;
      view: { hasFocus: () => boolean };
      from: number;
      to: number;
    }) =>
      shouldShowInlineFormatToolbar({
        editor,
        isBlockMenuOpen,
        // 툴바 버튼을 누르면 에디터가 blur되므로, 툴바 내부 포커스도 유효한 것으로 본다.
        hasEditorFocus:
          editorView.hasFocus() || element.contains(document.activeElement),
        from,
        to,
      }),
    [editor, isBlockMenuOpen],
  );

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShow}
      // 에디터 래퍼가 overflow-hidden이라 그 안에 붙으면 툴바가 잘린다.
      appendTo={() => document.body}
      options={{ placement: "top", offset: 8 }}
      className="z-40"
      data-testid="inline-format-toolbar"
    >
      <InlineFormatToolbarContent editor={editor} />
    </BubbleMenu>
  );
}

type InlineFormatToolbarContentProps = {
  editor: Editor;
};

export function InlineFormatToolbarContent({
  editor,
}: InlineFormatToolbarContentProps) {
  const [view, setView] = useState<ToolbarViewType>("format");

  const resetView = useCallback(() => setView("format"), []);

  // 선택이 바뀌면 툴바가 숨었다 다시 뜨므로, 링크/색 화면이 열린 채로 남지 않게 되돌린다.
  useEffect(() => {
    editor.on("selectionUpdate", resetView);

    return () => {
      editor.off("selectionUpdate", resetView);
    };
  }, [editor, resetView]);

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

      resetView();
    },
    [editor, resetView],
  );

  if (view === "link") {
    return (
      <LinkEditPopover
        initialUrl={editor.getAttributes("link").href ?? ""}
        onSubmit={handleLinkSubmit}
        onCancel={resetView}
      />
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md">
      {view === "color" ? (
        <>
          <ToolbarButton
            label="뒤로"
            onClick={resetView}
            icon={<ChevronLeft className="size-4" />}
          />
          <span
            aria-hidden="true"
            className="mx-0.5 h-5 w-px shrink-0 bg-border"
          />
          {buildNoteColorActions(editor, "color").map((action) => (
            <ToolbarButton
              key={action.id}
              label={action.label}
              active={action.active ?? false}
              onClick={() => {
                action.run();
                resetView();
              }}
              icon={
                action.swatch ? (
                  <NoteColorSwatch swatch={action.swatch} />
                ) : null
              }
            />
          ))}
        </>
      ) : (
        <>
          {buildInlineFormatActions({
            editor,
            onEditLink: () => setView("link"),
          }).map((action) => (
            <ToolbarButton
              key={action.id}
              label={action.label}
              active={action.active ?? false}
              onClick={action.run}
              icon={<ActionIcon action={action} />}
            />
          ))}
          <span
            aria-hidden="true"
            className="mx-0.5 h-5 w-px shrink-0 bg-border"
          />
          <ToolbarButton
            label="글자 색"
            onClick={() => setView("color")}
            icon={<Baseline className="size-4" />}
          />
        </>
      )}
    </div>
  );
}

function ActionIcon({ action }: { action: BlockActionType }) {
  const Icon = action.icon;

  return Icon ? <Icon className="size-4" /> : null;
}

type ToolbarButtonProps = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
};

function ToolbarButton({ label, icon, onClick, active }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      // pointerdown 기본 동작을 막지 않으면 에디터가 blur되면서 선택이 풀린다.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active ?? false}
      className={cn(
        "inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
