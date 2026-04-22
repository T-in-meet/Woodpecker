"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownNoteViewerClient } from "@/features/notes/components/MarkdownNoteViewerClient";

type ComparisonViewProps = {
  userAnswer: string;
  originalContent: string;
};

type ComparisonPanelProps = {
  title: string;
  content: string;
};

function ComparisonPanel({ title, content }: ComparisonPanelProps) {
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
  userAnswer,
  originalContent,
}: ComparisonViewProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ComparisonPanel title="내 답안" content={userAnswer} />
      <ComparisonPanel title="원본" content={originalContent} />
    </div>
  );
}
