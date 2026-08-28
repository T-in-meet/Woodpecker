"use client";

import { Bell, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationTimePicker } from "@/features/notifications/components/NotificationTimePicker";

import { DeleteNoteDialog } from "./DeleteNoteDialog";

type NoteManageMenuProps = {
  noteId: string;
  noteTitle: string;
  onEdit: () => void;
  /** 학습을 모두 마친 노트는 알림을 더 보내지 않으므로 항목을 감춘다. */
  canChangeNotificationTime: boolean;
  notificationTimeOfDay: string | null;
};

/**
 * 노트 수정·알림 시간 변경·삭제를 담는 관리 메뉴입니다.
 * 학습 행동(백지 테스트, 퀴즈)과 같은 줄에서 경쟁하지 않도록 메뉴로 접어 둡니다.
 */
export function NoteManageMenu({
  noteId,
  noteTitle,
  onEdit,
  canChangeNotificationTime,
  notificationTimeOfDay,
}: NoteManageMenuProps) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      {/* modal 기본값(true)은 메뉴가 열린 동안 body 스크롤을 잠근다.
          스크롤바가 사라지며 화면이 흔들리므로 잠그지 않는다. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon">
            <MoreHorizontal className="size-4" aria-hidden="true" />
            <span className="sr-only">노트 관리 메뉴</span>
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            노트 수정
          </DropdownMenuItem>

          {canChangeNotificationTime && (
            <DropdownMenuItem onSelect={() => setNotificationOpen(true)}>
              <Bell className="size-4" aria-hidden="true" />
              알림 시간 변경
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            노트 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canChangeNotificationTime && (
        <NotificationTimePicker
          noteId={noteId}
          initialTime={notificationTimeOfDay}
          open={notificationOpen}
          onOpenChange={setNotificationOpen}
        />
      )}

      <DeleteNoteDialog
        noteId={noteId}
        noteTitle={noteTitle}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
