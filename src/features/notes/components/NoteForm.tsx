"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/features/editor/components/CodeEditor";
import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import { usePreventPageLeave } from "@/hooks/usePreventPageLeave";
import {
  isCodeLanguage,
  isNoteLanguage,
  NOTE_LANGUAGE_VALUES,
  type NoteLanguage,
} from "@/lib/constants/noteLanguages";

import { createNoteAction } from "../actions";

const CONTENT_MAX_LENGTH = 50000;

export function NoteForm() {
  const [state, formAction, isPending] = useActionState(createNoteAction, null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState<NoteLanguage>("markdown");

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;

  const isDirty = title.length > 0 || content.length > 0;
  usePreventPageLeave(isDirty);

  const isMarkdown = !isCodeLanguage(language);

  return (
    <form
      action={formAction}
      className="mx-auto flex w-full max-w-4xl flex-col"
    >
      <div className="flex items-center justify-end gap-2 px-12 py-4">
        <label htmlFor="language" className="sr-only">
          언어
        </label>
        <select
          id="language"
          name="language"
          aria-label="언어"
          value={language}
          onChange={(event) => {
            const nextLanguage = event.target.value;

            if (isNoteLanguage(nextLanguage)) {
              setLanguage(nextLanguage);
            }
          }}
          className="h-7 cursor-pointer rounded-md border border-border bg-muted/50 px-2 text-xs text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {NOTE_LANGUAGE_VALUES.map((supportedLanguage) => (
            <option key={supportedLanguage} value={supportedLanguage}>
              {supportedLanguage}
            </option>
          ))}
        </select>

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

      {generalError && (
        <p role="alert" className="px-12 text-xs text-destructive">
          {generalError}
        </p>
      )}

      {fieldErrors?.language && (
        <p role="alert" className="px-12 text-xs text-destructive">
          {fieldErrors.language.join(" ")}
        </p>
      )}

      <div className="px-12 pt-8 pb-6">
        <input
          id="title"
          name="title"
          aria-label="제목"
          placeholder="제목 없음"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full border-none bg-transparent text-4xl font-bold text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
        />
        {fieldErrors?.title && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {fieldErrors.title.join(" ")}
          </p>
        )}
      </div>

      {!isMarkdown && <div className="border-t border-border/50" />}

      {fieldErrors?.content && (
        <p role="alert" className="px-12 pt-2 text-xs text-destructive">
          {fieldErrors.content.join(" ")}
        </p>
      )}

      <input type="hidden" name="content" value={content} />

      {isCodeLanguage(language) ? (
        <CodeEditor
          value={content}
          onChange={setContent}
          language={language}
          aria-label="내용"
          className="flex-1 rounded-none border-none [&_.cm-editor]:min-h-[70vh] [&_.cm-scroller]:min-h-[70vh] [&_.cm-content]:px-12! [&_.cm-content]:py-6! [&_.cm-gutters]:bg-transparent [&_.cm-gutters]:border-none"
        />
      ) : (
        <TipTapEditor
          value={content}
          onChange={setContent}
          placeholder="내용을 입력하세요..."
          autoFocus
          aria-label="내용"
          className="flex-1 rounded-none border-none focus-within:ring-0 focus-within:border-none [&_.tiptap]:min-h-[70vh] [&_.tiptap]:px-12! [&_.tiptap]:py-6!"
        />
      )}

      <div className="flex justify-end px-12 py-2">
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
      </div>
    </form>
  );
}
