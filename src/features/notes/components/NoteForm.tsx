"use client";

import type { Editor } from "@tiptap/react";
import { Bold, Code, Italic, Strikethrough } from "lucide-react";
import { useActionState, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/features/editor/components/CodeEditor";
import { TipTapEditor } from "@/features/editor/components/TipTapEditor";
import {
  isCodeLanguage,
  isNoteLanguage,
  NOTE_LANGUAGE_VALUES,
  type NoteLanguage,
} from "@/lib/constants/noteLanguages";

import { createNoteAction } from "../actions";

const CONTENT_MAX_LENGTH = 50000;

const TOOLBAR_BUTTONS = [
  {
    label: "두껍게",
    action: (e: Editor) => e.chain().focus().toggleBold().run(),
    icon: Bold,
    isActive: (e: Editor) => e.isActive("bold"),
  },
  {
    label: "기울임",
    action: (e: Editor) => e.chain().focus().toggleItalic().run(),
    icon: Italic,
    isActive: (e: Editor) => e.isActive("italic"),
  },
  {
    label: "취소선",
    action: (e: Editor) => e.chain().focus().toggleStrike().run(),
    icon: Strikethrough,
    isActive: (e: Editor) => e.isActive("strike"),
  },
  {
    label: "인라인 코드",
    action: (e: Editor) => e.chain().focus().toggleCode().run(),
    icon: Code,
    isActive: (e: Editor) => e.isActive("code"),
  },
] as const;

export function NoteForm() {
  const [state, formAction, isPending] = useActionState(createNoteAction, null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState<NoteLanguage>("markdown");
  const [editor, setEditor] = useState<Editor | null>(null);

  const handleEditorReady = useCallback((e: Editor) => setEditor(e), []);

  const fieldErrors =
    state?.error && typeof state.error === "object" ? state.error : null;
  const generalError =
    state?.error && typeof state.error === "string" ? state.error : null;

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

        <Button type="submit" size="sm" disabled={isPending}>
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

      {isMarkdown && editor && (
        <div className="flex gap-0.5 border-b border-border/50 px-12 py-1.5">
          {TOOLBAR_BUTTONS.map(({ label, action, icon: Icon, isActive }) => (
            <button
              key={label}
              type="button"
              title={label}
              onClick={() => action(editor)}
              aria-label={label}
              className={`rounded p-1.5 transition-colors ${
                isActive(editor)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      )}

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
          onEditorReady={handleEditorReady}
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
