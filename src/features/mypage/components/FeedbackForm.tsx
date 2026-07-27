"use client";

import { ImagePlus, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";

import { createFeedbackAction } from "../actions";
import type { FeedbackNoteOption } from "../queries";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_CONTENT_MAX_LENGTH,
  FEEDBACK_IMAGE_ALLOWED_TYPES,
  FEEDBACK_IMAGE_MAX_COUNT,
  FEEDBACK_IMAGE_MAX_SIZE,
  FEEDBACK_TITLE_MAX_LENGTH,
  type FeedbackCategory,
} from "../schema";

type FeedbackFormProps = {
  noteOptions: FeedbackNoteOption[];
  hasSubmittedToday: boolean;
};

type FieldErrors = Partial<
  Record<"category" | "title" | "content" | "noteId", string[]>
>;

const inputLikeClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function FeedbackForm({
  noteOptions,
  hasSubmittedToday,
}: FeedbackFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  const [category, setCategory] = useState<FeedbackCategory>("BUG");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [noteId, setNoteId] = useState("");
  const [images, setImages] = useState<File[]>([]);

  const [generalError, setGeneralError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const previews = useMemo(
    () => images.map((file) => URL.createObjectURL(file)),
    [images],
  );
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selected.length === 0) return;

    setGeneralError(null);

    const next = [...images, ...selected];
    if (next.length > FEEDBACK_IMAGE_MAX_COUNT) {
      setGeneralError(
        `이미지는 최대 ${FEEDBACK_IMAGE_MAX_COUNT}장까지 첨부할 수 있습니다`,
      );
      return;
    }

    for (const file of selected) {
      if (
        !(FEEDBACK_IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)
      ) {
        setGeneralError("JPG, PNG, GIF, WebP 형식만 업로드 가능합니다");
        return;
      }
      if (file.size > FEEDBACK_IMAGE_MAX_SIZE) {
        setGeneralError("이미지 크기는 장당 5MB 이하여야 합니다");
        return;
      }
    }

    setImages(next);
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors(null);
    setIsSubmitted(false);

    const formData = new FormData();
    formData.set("category", category);
    formData.set("title", title);
    formData.set("content", content);
    formData.set("noteId", noteId);
    for (const file of images) {
      formData.append("images", file);
    }

    startTransition(async () => {
      try {
        const result = await createFeedbackAction(null, formData);

        if (result && "data" in result) {
          setTitle("");
          setContent("");
          setNoteId("");
          setImages([]);
          setIsSubmitted(true);
          router.refresh();
          return;
        }

        if (typeof result?.error === "string") {
          setGeneralError(result.error);
        } else if (result?.error) {
          setFieldErrors(result.error);
        }
      } catch {
        setGeneralError("피드백 제출에 실패했습니다");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>피드백 보내기</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 pt-5">
          {hasSubmittedToday && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              오늘은 이미 피드백을 제출했어요. 내일 다시 제출할 수 있습니다.
            </p>
          )}

          <div className="space-y-2">
            <Label>분류</Label>
            <div className="flex gap-2">
              {FEEDBACK_CATEGORIES.map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={category === value ? "default" : "outline"}
                  onClick={() => setCategory(value)}
                >
                  {FEEDBACK_CATEGORY_LABELS[value]}
                </Button>
              ))}
            </div>
            {fieldErrors?.category && (
              <p className="text-sm text-destructive">
                {fieldErrors.category[0]}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-title">제목</Label>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={FEEDBACK_TITLE_MAX_LENGTH}
              placeholder={`제목 (${FEEDBACK_TITLE_MAX_LENGTH}자 이내)`}
            />
            {fieldErrors?.title && (
              <p className="text-sm text-destructive">{fieldErrors.title[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-content">내용</Label>
            <textarea
              id="feedback-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={FEEDBACK_CONTENT_MAX_LENGTH}
              placeholder="건의사항이나 문의 내용을 입력해주세요"
              className={cn(
                inputLikeClassName,
                "min-h-32 resize-y py-2 placeholder:text-muted-foreground",
              )}
            />
            <p className="text-right text-xs text-muted-foreground">
              {content.length.toLocaleString("ko-KR")} /{" "}
              {FEEDBACK_CONTENT_MAX_LENGTH.toLocaleString("ko-KR")}
            </p>
            {fieldErrors?.content && (
              <p className="text-sm text-destructive">
                {fieldErrors.content[0]}
              </p>
            )}
          </div>

          {noteOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="feedback-note">관련 노트 (선택)</Label>
              <select
                id="feedback-note"
                value={noteId}
                onChange={(e) => setNoteId(e.target.value)}
                className={cn(inputLikeClassName, "cursor-pointer")}
              >
                <option value="">연결 안 함</option>
                {noteOptions.map((note) => (
                  <option key={note.id} value={note.id}>
                    {note.title}
                  </option>
                ))}
              </select>
              {fieldErrors?.noteId && (
                <p className="text-sm text-destructive">
                  {fieldErrors.noteId[0]}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>
              이미지 첨부{" "}
              <span className="font-normal text-muted-foreground">
                ({images.length}/{FEEDBACK_IMAGE_MAX_COUNT})
              </span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              {previews.map((url, index) => (
                <div key={url} className="relative">
                  <Image
                    src={url}
                    alt={`첨부 이미지 ${index + 1}`}
                    width={80}
                    height={80}
                    unoptimized
                    className="size-20 rounded-md border object-cover"
                  />
                  <button
                    type="button"
                    aria-label="이미지 제거"
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -right-1.5 -top-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {images.length < FEEDBACK_IMAGE_MAX_COUNT && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="size-4" />
                  추가
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={FEEDBACK_IMAGE_ALLOWED_TYPES.join(",")}
                className="hidden"
                onChange={handleAddImages}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              장당 5MB 이하, JPG·PNG·GIF·WebP
            </p>
          </div>

          {generalError && (
            <p className="text-sm text-destructive">{generalError}</p>
          )}
          {isSubmitted && (
            <p className="text-sm text-primary">
              피드백이 제출되었습니다. 소중한 의견 감사합니다!
            </p>
          )}

          <Button type="submit" disabled={isPending || hasSubmittedToday}>
            {isPending ? "제출 중..." : "제출"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
