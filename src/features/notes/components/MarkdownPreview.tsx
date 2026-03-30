"use client";

import { useMemo, useRef } from "react";
import type { Components } from "react-markdown";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils/cn";

type MarkdownPreviewProps = {
  content: string;
  className?: string;
  onToggleCheckbox?: (index: number) => void;
};

export function MarkdownPreview({
  content,
  className,
  onToggleCheckbox,
}: MarkdownPreviewProps) {
  const checkboxIndexRef = useRef(0);
  // 렌더마다 체크박스 카운터를 초기화해 각 체크박스에 안정적인 인덱스를 부여
  checkboxIndexRef.current = 0;

  const components = useMemo<Components>(
    () => ({
      input({
        type,
        checked,
        className: inputClassName,
        disabled: _disabled,
        node: _node,
        ...props
      }) {
        if (type !== "checkbox") {
          return (
            <input
              type={type}
              checked={checked}
              className={inputClassName}
              {...props}
            />
          );
        }

        const index = checkboxIndexRef.current++;

        return (
          <input
            {...props}
            type="checkbox"
            checked={Boolean(checked)}
            disabled={!onToggleCheckbox}
            onChange={
              onToggleCheckbox ? () => onToggleCheckbox(index) : undefined
            }
            className={cn(onToggleCheckbox && "cursor-pointer", inputClassName)}
          />
        );
      },
    }),
    [onToggleCheckbox],
  );

  if (!content) {
    return (
      <div className={cn("px-12 py-6 text-muted-foreground/40", className)}>
        미리보기할 내용이 없습니다.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none px-12 py-6",
        "prose-headings:font-bold prose-headings:text-foreground",
        "prose-p:text-foreground prose-p:leading-relaxed",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-mono prose-code:text-foreground prose-code:before:content-none prose-code:after:content-none",
        "prose-pre:rounded-lg prose-pre:bg-zinc-900 prose-pre:p-4 prose-pre:text-zinc-100 dark:prose-pre:bg-zinc-800",
        "prose-blockquote:border-l-primary/50",
        "prose-img:rounded-lg",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
}
