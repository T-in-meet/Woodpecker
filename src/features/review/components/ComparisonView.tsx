"use client";

import hljs from "highlight.js";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          <CodeComparisonPanel content={content} language={effectiveLanguage} />
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

function CodeComparisonPanel({
  content,
  language,
}: {
  content: string;
  language: Exclude<NoteLanguage, "markdown">;
}) {
  const highlighted = hljs.highlight(content, {
    language,
    ignoreIllegals: true,
  });

  return (
    <pre className="min-h-[50vh] overflow-x-auto bg-zinc-900 px-6 py-5 font-mono text-base leading-relaxed text-zinc-100">
      <code
        className={`hljs language-${language}`}
        dangerouslySetInnerHTML={{ __html: highlighted.value }}
      />
    </pre>
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
