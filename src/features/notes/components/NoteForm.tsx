"use client";

import type { Editor } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";
import { getNoteDetailRoute } from "@/lib/constants/routes";

import { createNoteAction } from "../actions";

const CONTENT_MAX_LENGTH = 50000;

export function NoteForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createNoteAction, null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;

  const isDirty = (title.length > 0 || content.length > 0) && !createdNoteId;
  usePreventPageLeave(isDirty);

  useEffect(() => {
    if (state?.success) {
      setCreatedNoteId(state.newNoteId);
    }
  }, [state]);

  useEffect(() => {
    if (!createdNoteId) return;

    router.push(getNoteDetailRoute(createdNoteId));
  }, [createdNoteId, router]);

  const focusContentStart = () => {
    editorRef.current?.commands.focus("start");
  };

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      focusContentStart();
    }
  };

  const handleArrowUpFromContent = () => {
    const input = titleInputRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-4xl flex-col"
    >
      {generalError && (
        <p role="alert" className="px-12 pt-4 text-xs text-destructive">
          {generalError}
        </p>
      )}

      <div className="px-12 pt-8 pb-6">
        <input
          ref={titleInputRef}
          id="title"
          name="title"
          aria-label="제목"
          placeholder="제목 없음"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          className="w-full border-none bg-transparent text-4xl font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
        />
        {fieldErrors?.title && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {fieldErrors.title.join(" ")}
          </p>
        )}
      </div>

      {fieldErrors?.content && (
        <p role="alert" className="px-12 pt-2 text-xs text-destructive">
          {fieldErrors.content.join(" ")}
        </p>
      )}

      <input type="hidden" name="content" value={content} />

      <TipTapEditor
        value={content}
        onChange={setContent}
        placeholder="내용을 입력하세요..."
        autoFocus
        aria-label="내용"
        onEditorReady={(editor) => {
          editorRef.current = editor;
        }}
        onArrowUpAtStart={handleArrowUpFromContent}
        className="flex-1 rounded-none border-none focus-within:ring-0 focus-within:border-none [&_.tiptap]:min-h-[70vh] [&_.tiptap]:px-12! [&_.tiptap]:py-6!"
      />

      <div className="flex items-center justify-end gap-3 px-12 py-2">
        <span
          aria-live="polite"
          className={`text-xs tabular-nums ${
            content.length > CONTENT_MAX_LENGTH
              ? "text-destructive"
              : content.length >= CONTENT_MAX_LENGTH * 0.9
                ? "text-amber-500"
                : "text-muted-foreground/50"
          }`}
        >
          {content.length.toLocaleString()} /{" "}
          {CONTENT_MAX_LENGTH.toLocaleString()}
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={isPending || content.length > CONTENT_MAX_LENGTH}
          title={
            content.length > CONTENT_MAX_LENGTH
              ? "내용이 최대 글자수를 초과했습니다"
              : undefined
          }
        >
          {isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}
