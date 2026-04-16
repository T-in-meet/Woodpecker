"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeEditor } from "@/features/editor/components/CodeEditor";
import { MarkdownNoteViewerClient } from "@/features/notes/components/MarkdownNoteViewerClient";
import {
  isCodeLanguage,
  type NoteLanguage,
} from "@/lib/constants/noteLanguages";

type ComparisonViewProps = {
  language: NoteLanguage | null;
  userAnswer: string;
  originalContent: string;
};

type ComparisonPanelProps = {
  title: string;
  content: string;
  language: NoteLanguage | null;
};

function ComparisonPanel({ title, content, language }: ComparisonPanelProps) {
  const effectiveLanguage = language ?? "markdown";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!content ? (
          <div className="px-6 py-5 text-sm text-muted-foreground/60">
            내용이 없습니다.
          </div>
        ) : isCodeLanguage(effectiveLanguage) ? (
          <CodeEditor
            value={content}
            language={effectiveLanguage}
            readOnly
            aria-label={title}
            className="min-h-[50vh] rounded-none border-none [&_.cm-editor]:min-h-[50vh] [&_.cm-scroller]:min-h-[50vh] [&_.cm-content]:px-6! [&_.cm-content]:py-5! [&_.cm-gutters]:border-none [&_.cm-gutters]:bg-transparent"
          />
        ) : (
          <MarkdownNoteViewerClient
            content={content}
            className="min-h-[50vh] rounded-none border-none focus-within:border-none focus-within:ring-0 [&_.tiptap]:min-h-[50vh] [&_.tiptap]:px-6! [&_.tiptap]:py-5!"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ComparisonView({
  language,
  userAnswer,
  originalContent,
}: ComparisonViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ComparisonPanel
        title="내 답안"
        content={userAnswer}
        language={language}
      />
      <ComparisonPanel
        title="원본"
        content={originalContent}
        language={language}
      />
    </div>
  );
}
