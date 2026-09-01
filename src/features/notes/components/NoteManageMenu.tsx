"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
import { NOTIFICATIONS_QUERY_KEY } from "@/features/notifications/query-keys";

import { setNoteReviewCompletedAction } from "../actions";
import { DeleteNoteDialog } from "./DeleteNoteDialog";

type NoteManageMenuProps = {
  noteId: string;
  noteTitle: string;
  onEdit: () => void;
  onEditIntent: () => void;
  /** 사용자가 직접 완료 표시한 노트인지. 토글 문구와 아이콘을 가른다. */
  isCompletedByUser: boolean;
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
  isCompletedByUser,
  canChangeNotificationTime,
  notificationTimeOfDay,
  nextScheduledAt,
}: NoteManageMenuProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [hasNotificationOpened, setHasNotificationOpened] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isTogglingCompletion, startCompletionTransition] = useTransition();

  /**
   * 복습 완료 표시를 켜고 끈다. 해제하면 저장된 pending 일정 또는 DB가 복구한
   * 다음 일정에서 알림과 복습이 다시 이어진다.
   */
  const toggleReviewCompleted = () => {
    startCompletionTransition(async () => {
      const result = await setNoteReviewCompletedAction(
        noteId,
        !isCompletedByUser,
      );

      if ("error" in result) {
        return;
      }

      await queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEY.all,
      });
      router.refresh();
    });
  };

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

        {/* min-w: 기본 min-w-32는 "복습 완료로 표시"가 두 줄로 접힌다. 가장 긴
            항목이 한 줄에 들어가는 선까지만 넓힌다.
            collisionPadding: Radix 기본값 0이라 좁은 화면에서 메뉴가 뷰포트
            왼쪽 끝에 붙는다. 가장자리와 간격을 둔다. */}
        <DropdownMenuContent
          align="end"
          collisionPadding={16}
          className="min-w-40"
        >
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

          <DropdownMenuItem
            disabled={isTogglingCompletion}
            onSelect={toggleReviewCompleted}
          >
            {isCompletedByUser ? (
              <RotateCcw className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4" aria-hidden="true" />
            )}
            {isCompletedByUser ? "복습 다시 시작" : "복습 완료로 표시"}
          </DropdownMenuItem>

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
