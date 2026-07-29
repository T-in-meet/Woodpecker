"use client";

import type { Editor } from "@tiptap/react";
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
  type BlockActionType,
  buildBlockActionGroups,
} from "@/features/editor/utils/blockActionGroups";

import { LinkEditPopover } from "./LinkEditPopover";
import { NoteColorSwatch } from "./NoteColorSwatch";

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
