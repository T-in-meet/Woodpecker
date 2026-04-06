"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn";

import { isSafeLinkHref, normalizeLinkHref } from "../utils/linkValidation";

type LinkEditPopoverProps = {
  initialUrl: string;
  onSubmit: (url: string) => void;
  onCancel: () => void;
};

export function LinkEditPopover({
  initialUrl,
  onSubmit,
  onCancel,
}: LinkEditPopoverProps) {
  const [url, setUrl] = useState(initialUrl);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed === "") {
      onSubmit("");
      return;
    }
    const normalizedHref = normalizeLinkHref(trimmed);
    if (!normalizedHref) {
      setError("허용되지 않는 링크 형식입니다.");
      return;
    }
    setError("");
    onSubmit(normalizedHref);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextUrl = event.target.value;
    setUrl(nextUrl);

    if (error === "") {
      return;
    }

    const trimmed = nextUrl.trim();

    if (trimmed === "" || isSafeLinkHref(trimmed)) {
      setError("");
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmit();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-popover p-1 shadow-md">
      <input
        ref={inputRef}
        type="url"
        value={url}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="https://..."
        className={cn(
          "h-7 w-56 rounded-md bg-transparent px-2 text-sm outline-none",
          "placeholder:text-muted-foreground",
          error && "text-destructive",
        )}
        aria-label="링크 URL"
        aria-invalid={error !== ""}
        title={error || undefined}
      />
      <button
        type="button"
        onClick={handleSubmit}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="링크 확인"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="취소"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
