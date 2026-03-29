"use client";

import { Bold, Code, Italic, Strikethrough } from "lucide-react";
import { useActionState, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { CodeEditor } from "@/features/editor/components/CodeEditor";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/features/editor/components/MarkdownEditor";
import { MarkdownPreview } from "@/features/notes/components/MarkdownPreview";
import {
  isCodeLanguage,
  isNoteLanguage,
  NOTE_LANGUAGE_VALUES,
  type NoteLanguage,
} from "@/lib/constants/noteLanguages";

import { createNoteAction } from "../actions";
import { toggleMarkdownTaskItem } from "../utils/toggleMarkdownTaskItem";

type EditorTab = "write" | "preview";

const CONTENT_MAX_LENGTH = 50000;

const TOOLBAR_BUTTONS = [
  { label: "두껍게", action: "toggleBold", icon: Bold },
  { label: "기울임", action: "toggleItalic", icon: Italic },
  { label: "취소선", action: "toggleStrikethrough", icon: Strikethrough },
  { label: "인라인 코드", action: "toggleCode", icon: Code },
] as const;

export function NoteForm() {
  const [state, formAction, isPending] = useActionState(createNoteAction, null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState<NoteLanguage>("markdown");
  const [activeTab, setActiveTab] = useState<EditorTab>("write");
  const editorRef = useRef<MarkdownEditorHandle>(null);

  const handleToggleCheckbox = (index: number) => {
    setContent((prev) => toggleMarkdownTaskItem(prev, index));
  };

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
              setActiveTab("write");
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

      {isMarkdown && (
        <div
          className="flex gap-1 border-b border-border/50 px-12"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            id="tab-write"
            aria-selected={activeTab === "write"}
            aria-controls="tabpanel-editor"
            onClick={() => setActiveTab("write")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              activeTab === "write"
                ? "border-b-2 border-foreground font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            편집
          </button>
          <button
            type="button"
            role="tab"
            id="tab-preview"
            aria-selected={activeTab === "preview"}
            aria-controls="tabpanel-editor"
            onClick={() => setActiveTab("preview")}
            className={`px-3 py-1.5 text-sm transition-colors ${
              activeTab === "preview"
                ? "border-b-2 border-foreground font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            미리보기
          </button>
        </div>
      )}

      {isMarkdown && activeTab === "write" && (
        <div className="flex gap-0.5 border-b border-border/50 px-12 py-1.5">
          {TOOLBAR_BUTTONS.map(({ label, action, icon: Icon }) => (
            <button
              key={action}
              type="button"
              title={label}
              onClick={() => editorRef.current?.[action]()}
              aria-label={label}
              className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
        <div
          role="tabpanel"
          id="tabpanel-editor"
          aria-labelledby={activeTab === "write" ? "tab-write" : "tab-preview"}
          className="flex-1"
        >
          {activeTab === "write" ? (
            <MarkdownEditor
              ref={editorRef}
              value={content}
              onChange={setContent}
              placeholder="내용을 입력하세요..."
              aria-label="내용"
              className="rounded-none border-none focus-within:ring-0 focus-within:border-none [&_.cm-editor]:min-h-[70vh] [&_.cm-scroller]:min-h-[70vh] [&_.cm-content]:px-12! [&_.cm-content]:py-6! [&_.cm-gutters]:bg-transparent [&_.cm-gutters]:border-none"
            />
          ) : (
            <MarkdownPreview
              content={content}
              className="min-h-[70vh]"
              onToggleCheckbox={handleToggleCheckbox}
            />
          )}
        </div>
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
