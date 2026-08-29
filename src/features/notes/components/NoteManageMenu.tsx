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
import {
  LazyNotificationSchedulePicker,
  preloadNotificationSchedulePicker,
} from "@/features/notifications/components/LazyNotificationSchedulePicker";

import { DeleteNoteDialog } from "./DeleteNoteDialog";

type NoteManageMenuProps = {
  noteId: string;
  noteTitle: string;
  onEdit: () => void;
  onEditIntent: () => void;
  /** 학습을 모두 마친 노트는 알림을 더 보내지 않으므로 항목을 감춘다. */
  canChangeNotificationTime: boolean;
  notificationTimeOfDay: string | null;
  /** 다음 알림이 나갈 시각. 달력의 초기 선택 날짜가 된다. */
  nextScheduledAt: string | null;
};

/**
 * 노트 수정·복습 일정 변경·삭제를 담는 관리 메뉴입니다.
 * 학습 행동(백지 테스트, 퀴즈)과 같은 줄에서 경쟁하지 않도록 메뉴로 접어 둡니다.
 */
export function NoteManageMenu({
  noteId,
  noteTitle,
  onEdit,
  onEditIntent,
  canChangeNotificationTime,
  notificationTimeOfDay,
  nextScheduledAt,
}: NoteManageMenuProps) {
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [hasNotificationOpened, setHasNotificationOpened] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const openNotificationSchedule = () => {
    setHasNotificationOpened(true);
    setNotificationOpen(true);
  };

  /**
   * 메뉴가 닫히며 트리거로 포커스를 되돌리는 동작과 항목이 여는 화면의 초기 포커스가
   * 같은 틱에 겹치면 포커스를 뺏기거나(다이얼로그) 되돌릴 트리거 자체가 사라진다
   * (편집 폼 전환). 한 프레임 뒤로 미뤄 포커스 복귀가 끝난 다음에 실행한다.
   */
  const openAfterMenuCloses = (openTarget: () => void) => {
    requestAnimationFrame(openTarget);
  };

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
          {/* 편집 폼으로 바뀌면서 이 메뉴(트리거 포함)가 언마운트되므로, 메뉴가
              포커스를 트리거로 되돌린 다음에 전환해야 포커스가 body로 떨어지지 않는다. */}
          <DropdownMenuItem
            onPointerEnter={onEditIntent}
            onFocus={onEditIntent}
            onSelect={() => openAfterMenuCloses(onEdit)}
          >
            <Pencil className="size-4" aria-hidden="true" />
            노트 수정
          </DropdownMenuItem>

          {canChangeNotificationTime && (
            <DropdownMenuItem
              onPointerEnter={preloadNotificationSchedulePicker}
              onFocus={preloadNotificationSchedulePicker}
              onSelect={() => openAfterMenuCloses(openNotificationSchedule)}
            >
              <Bell className="size-4" aria-hidden="true" />
              복습 일정 변경
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            onSelect={() => openAfterMenuCloses(() => setDeleteOpen(true))}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            노트 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canChangeNotificationTime && hasNotificationOpened ? (
        <LazyNotificationSchedulePicker
          noteId={noteId}
          initialTime={notificationTimeOfDay}
          initialScheduledAt={nextScheduledAt}
          open={notificationOpen}
          onOpenChange={setNotificationOpen}
        />
      ) : null}

      <DeleteNoteDialog
        noteId={noteId}
        noteTitle={noteTitle}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
