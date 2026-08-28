"use client";

import ReactMarkdown from "react-markdown";

import type { NoteChatAssistantSources } from "../types";
import { NoteChatAssistantMessageActions } from "./NoteChatAssistantMessageActions";
import { NoteChatReferenceNotes } from "./NoteChatReferenceNotes";

/**
 * 노트 챗봇 Assistant 메시지 컴포넌트의 입력값입니다.
 */
type NoteChatAssistantMessageProps = {
  /** Assistant가 생성한 메시지 본문입니다. */
  text: string;

  /** Assistant 답변 생성에 사용된 검색 노트 출처입니다. */
  sources?: NoteChatAssistantSources["sources"];

  /** Assistant 답변에서 실제로 사용한 노트 ID 목록입니다. */
  usedNoteIds?: string[];

  /** 현재 Assistant 답변을 스트리밍 중인지 여부입니다. */
  isStreaming?: boolean;
};

/**
 * 노트 챗봇 Assistant 메시지를 본문 형태로 표시합니다.
 *
 * Markdown 형식의 답변과 참조 노트를 렌더링하며,
 * 스트리밍이 완료된 응답에는 복사 및 신고 이동 등의 Assistant 메시지 액션을
 * 함께 표시합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.text Assistant 메시지 본문
 * @param props.sources 답변 생성에 사용된 검색 노트 출처
 * @param props.usedNoteIds 답변에서 실제로 사용한 노트 ID 목록
 * @param props.isStreaming 현재 답변 스트리밍 여부
 * @returns 노트 챗봇 Assistant 메시지 UI
 */
export function NoteChatAssistantMessage({
  text,
  sources = [],
  usedNoteIds = [],
  isStreaming = false,
}: NoteChatAssistantMessageProps) {
  return (
    <li className="w-full space-y-1">
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

        {/* 답변 생성에 사용된 노트가 있는 경우에만 참조 노트 정보를 표시합니다. */}
        {sources.length > 0 || usedNoteIds.length > 0 ? (
          <NoteChatReferenceNotes sources={sources} usedNoteIds={usedNoteIds} />
        ) : null}
      </div>

      {/*
       * 스트리밍 중인 응답은 생성이 진행 중이므로 액션을 제공하지 않습니다.
       * 생성이 완료된 Assistant 메시지에만 복사 및 신고 이동 액션을 표시합니다.
       */}
      {!isStreaming ? <NoteChatAssistantMessageActions content={text} /> : null}
    </li>
  );
}
