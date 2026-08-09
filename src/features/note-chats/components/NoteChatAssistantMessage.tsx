"use client";

import ReactMarkdown from "react-markdown";

import type { NoteChatAssistantSources } from "../types";
import { NoteChatReferenceNotes } from "./NoteChatReferenceNotes";

type NoteChatAssistantMessageProps = {
  text: string;
  sources?: NoteChatAssistantSources["sources"];
  usedNoteIds?: string[];
  isStreaming?: boolean;
};

/**
 * 노트 챗봇 Assistant 메시지를 본문 형태로 표시합니다.
 */
export function NoteChatAssistantMessage({
  text,
  sources = [],
  usedNoteIds = [],
  isStreaming = false,
}: NoteChatAssistantMessageProps) {
  return (
    <li className="w-full">
      <div className="w-full space-y-3 rounded-lg border bg-muted/30 px-4 py-4">
        <div
          {...(isStreaming ? { "aria-live": "polite" as const } : {})}
          className="text-sm leading-7"
        >
          <ReactMarkdown
            components={{
              h1: ({ children }) => (
                <h1 className="mt-6 mb-3 text-xl font-semibold first:mt-0">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-5 mb-3 text-lg font-semibold first:mt-0">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-4 mb-2 text-base font-semibold first:mt-0">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="my-2 leading-7 first:mt-0 last:mb-0">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold">{children}</strong>
              ),
              code: ({ children }) => (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-sm">
                  {children}
                </code>
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        </div>

        {sources.length > 0 || usedNoteIds.length > 0 ? (
          <NoteChatReferenceNotes sources={sources} usedNoteIds={usedNoteIds} />
        ) : null}
      </div>
    </li>
  );
}
