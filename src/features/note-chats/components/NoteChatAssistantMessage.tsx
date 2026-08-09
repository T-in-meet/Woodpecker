"use client";

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
          <p className="whitespace-pre-wrap">{text}</p>
        </div>

        {sources.length > 0 || usedNoteIds.length > 0 ? (
          <NoteChatReferenceNotes sources={sources} usedNoteIds={usedNoteIds} />
        ) : null}
      </div>
    </li>
  );
}
