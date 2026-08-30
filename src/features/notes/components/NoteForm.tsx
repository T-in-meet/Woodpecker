"use client";

import type { Editor } from "@tiptap/react";
import { Check, Loader2 } from "lucide-react";
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
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;

  const hasTitle = title.trim().length > 0;
  const hasContent = content.trim().length > 0;
  const isContentTooLong = content.length > CONTENT_MAX_LENGTH;
  const isRedirecting = state?.success === true;
  const isBusy = isPending || isRedirecting;
  const canSubmit = hasTitle && hasContent && !isContentTooLong && !isBusy;
  const isDirty = (title.length > 0 || content.length > 0) && !isRedirecting;
  usePreventPageLeave(isDirty);

  const saveStatus = isRedirecting
    ? "저장 완료 · 노트로 이동 중…"
    : isPending
      ? "저장 중…"
      : !hasTitle && !hasContent
        ? "제목과 내용을 입력하면 저장할 수 있어요"
        : !hasTitle
          ? "제목을 입력해주세요"
          : !hasContent
            ? "내용을 입력해주세요"
            : isContentTooLong
              ? "내용이 최대 글자 수를 초과했어요"
              : "저장되지 않은 변경사항";

  useEffect(() => {
    if (!state?.success) return;

    router.replace(getNoteDetailRoute(state.newNoteId));
  }, [state, router]);

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
      aria-busy={isBusy}
      className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 md:py-10"
    >
      <section aria-label="새 노트 작성" className="min-w-0">
        {generalError ? (
          <p
            role="alert"
            className="px-5 pt-4 text-xs text-destructive sm:px-8 md:px-12"
          >
            {generalError}
          </p>
        ) : null}

        <div className="px-5 pb-6 pt-8 sm:px-8 md:px-12">
          <input
            ref={titleInputRef}
            id="title"
            name="title"
            aria-label="제목"
            placeholder="노트 제목"
            autoComplete="off"
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            disabled={isBusy}
            autoFocus
            className="w-full border-none bg-transparent text-4xl font-bold leading-snug text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus-visible:bg-muted/10 disabled:cursor-wait disabled:opacity-70"
          />
          {fieldErrors?.title ? (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {fieldErrors.title.join(" ")}
            </p>
          ) : null}
        </div>

        {fieldErrors?.content ? (
          <p
            role="alert"
            className="px-5 pb-2 text-xs text-destructive sm:px-8 md:px-12"
          >
            {fieldErrors.content.join(" ")}
          </p>
        ) : null}

        <input type="hidden" name="content" value={content} />

        <TipTapEditor
          value={content}
          onChange={setContent}
          aria-label="내용"
          readOnly={isBusy}
          placeholder="학습할 내용을 입력하세요. /를 누르면 편집 메뉴가 열립니다."
          onEditorReady={(editor) => {
            editorRef.current = editor;
          }}
          onArrowUpAtStart={handleArrowUpFromContent}
          className="rounded-none border-none focus-within:bg-muted/10 focus-within:ring-0 [&_.tiptap]:min-h-[clamp(22rem,52vh,36rem)] [&_.tiptap]:px-5! [&_.tiptap]:py-6! sm:[&_.tiptap]:px-8! md:[&_.tiptap]:px-12! [&_.tiptap_p.is-editor-empty:first-child::before]:opacity-100"
        />

        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 px-5 py-3 sm:px-8 md:px-12">
          <span
            id="note-save-status"
            role="status"
            aria-live="polite"
            className="text-xs text-muted-foreground"
          >
            {saveStatus}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span
              className={`text-xs tabular-nums ${
                isContentTooLong
                  ? "text-destructive"
                  : content.length >= CONTENT_MAX_LENGTH * 0.9
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }`}
            >
              {content.length.toLocaleString()} /{" "}
              {CONTENT_MAX_LENGTH.toLocaleString()}
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={!canSubmit}
              aria-describedby="note-save-status"
              title={
                isContentTooLong
                  ? "내용이 최대 글자수를 초과했습니다"
                  : undefined
              }
            >
              {isRedirecting ? (
                <>
                  <Check data-icon="inline-start" aria-hidden="true" />
                  저장됨
                </>
              ) : isPending ? (
                <>
                  <Loader2
                    data-icon="inline-start"
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                  저장 중…
                </>
              ) : (
                "저장"
              )}
            </Button>
          </div>
        </footer>
      </section>
    </form>
  );
}
