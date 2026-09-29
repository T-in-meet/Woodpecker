"use client";

import type { Editor } from "@tiptap/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import {
  type BlockActionType,
  buildBlockActionGroups,
} from "@/features/editor/utils/blockActionGroups";
import { useIsMobile } from "@/hooks/use-mobile";

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
  // 모바일은 메인 메뉴 옆에 하위 메뉴를 띄울 폭이 없어, 같은 패널 안에서 하위 항목으로 전환한다.
  const isMobile = useIsMobile();
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pendingGroupFocusRef = useRef<string | null>(null);

  useEffect(() => {
    const groupId = pendingGroupFocusRef.current;
    if (!groupId) return;
    pendingGroupFocusRef.current = null;
    // 항목 교체로 사라진 포커스를 진입 시 뒤로 버튼, 복귀 시 원래 그룹에 돌려준다.
    menuRef.current
      ?.querySelector<HTMLElement>(
        `[data-mobile-menu-item="${openGroupId ? "back" : groupId}"]`,
      )
      ?.focus();
  }, [openGroupId]);
  // 핸들 왼쪽에 공간이 없는 좁은 화면에서는 핸들 아래로 연다.
  const menuSide = isMobile ? "bottom" : "left";

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

  const openGroup = isMobile
    ? groups.find((group) => group.id === openGroupId && group.submenu)
    : undefined;

  if (showLinkEdit) {
    return (
      <DropdownMenuContent
        align="start"
        side={menuSide}
        sideOffset={8}
        collisionPadding={16}
        className="w-64 max-w-[calc(100vw-2rem)] p-0"
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
      ref={menuRef}
      align="start"
      side={menuSide}
      sideOffset={8}
      collisionPadding={16}
      className="w-64 max-w-[calc(100vw-2rem)]"
      onKeyDown={handleDeleteShortcut}
      onCloseAutoFocus={(event) => {
        // Radix 기본 동작은 트리거(핸들 버튼)로 포커스를 되돌리는데, 그러면 블록이
        // 선택된 상태여도 Ctrl+C가 에디터에 닿지 않는다.
        event.preventDefault();
        // 다시 열면 하위 항목이 아니라 첫 목록부터 보이게 한다.
        setOpenGroupId(null);

        if (!editor.isDestroyed) {
          editor.view.focus();
        }
      }}
    >
      {openGroup ? (
        <>
          <DropdownMenuItem
            data-mobile-menu-item="back"
            className="cursor-pointer font-medium"
            onSelect={(event) => {
              // 메뉴를 닫지 않고 첫 목록으로 돌아간다.
              event.preventDefault();
              pendingGroupFocusRef.current = openGroup.id;
              setOpenGroupId(null);
            }}
          >
            <ChevronLeft />
            {openGroup.label}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {openGroup.actions.map((action) => (
            <BlockActionMenuItem key={action.id} action={action} />
          ))}
        </>
      ) : (
        groups.map((group, groupIndex) => (
          <div key={group.id}>
            {groupIndex > 0 && <DropdownMenuSeparator />}
            {group.submenu && isMobile ? (
              <DropdownMenuItem
                data-mobile-menu-item={group.id}
                className="cursor-pointer"
                onSelect={(event) => {
                  event.preventDefault();
                  pendingGroupFocusRef.current = group.id;
                  setOpenGroupId(group.id);
                }}
              >
                <group.icon />
                <span className="flex-1 truncate">{group.label}</span>
                <ChevronRight className="ml-auto" />
              </DropdownMenuItem>
            ) : group.submenu ? (
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
