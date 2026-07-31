"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";

import { updateNoteAction } from "../actions";

const CONTENT_MAX_LENGTH = 50000;

type NoteEditFormProps = {
  noteId: string;
  initialTitle: string;
  initialContent: string;
  onCancel: () => void;
  onSaved: () => void;
};

// 편집 모드에서만 마운트되므로, 편집을 닫으면 useActionState의 이전 에러도 함께 사라진다.
// 저장 실패 후 취소하고 다시 열었을 때 지난 에러가 남아 있지 않게 하려는 의도다.
export function NoteEditForm({
  noteId,
  initialTitle,
  initialContent,
  onCancel,
  onSaved,
}: NoteEditFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [state, formAction, isPending] = useActionState(
    updateNoteAction.bind(null, noteId),
    null,
  );

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;

  const isDirty = title !== initialTitle || content !== initialContent;
  usePreventPageLeave(isDirty);

  useEffect(() => {
    if (state?.success) {
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form action={formAction}>
      {generalError && (
        <p role="alert" className="pb-2 text-xs text-destructive">
          {generalError}
        </p>
      )}
      <input
        name="title"
        aria-label="제목"
        maxLength={100}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="w-full border-none bg-transparent text-3xl font-bold leading-snug text-foreground focus:outline-none"
      />
      {fieldErrors?.title && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {fieldErrors.title.join(" ")}
        </p>
      )}

      <input type="hidden" name="content" value={content} />
      {fieldErrors?.content && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {fieldErrors.content.join(" ")}
        </p>
      )}

      <TipTapEditor
        value={content}
        onChange={setContent}
        aria-label="내용"
        className="mt-4 [&_.tiptap]:min-h-[60vh]"
      />

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
          className="cursor-pointer"
        >
          취소
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || content.length > CONTENT_MAX_LENGTH}
          className="cursor-pointer"
        >
          {isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
