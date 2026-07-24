import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";

import { useDeleteFeedbackReply } from "../hooks/queries/use-delete-feedback-reply";
import { useSaveFeedbackReply } from "../hooks/queries/use-save-feedback-reply";
import {
  FEEDBACK_REPLY_ALLOWED_TYPES,
  FEEDBACK_REPLY_MAX_IMAGE_COUNT,
  feedbackReplyFormSchema,
  type FeedbackReplyFormValues,
} from "../schemas/feedback-reply-schema";
import type { AdminFeedbackDetail } from "../types/feedback-detail";

interface AdminFeedbackReplyPanelProps {
  /** 답변을 작성하거나 수정할 피드백 상세 데이터 */
  feedback: AdminFeedbackDetail;
}

/**
 * 아직 업로드하지 않은 새 답변 이미지의 클라이언트 미리보기 상태입니다.
 */
interface PreviewImage {
  id: string;
  file: File;
  url: string;
}

/**
 * 관리자 답변 조회, 작성, 수정을 담당하는 상세 페이지 우측 패널입니다.
 *
 * 기존 답변이 있으면 읽기 모드로 시작하고, 답변이 없으면 작성 모드로 시작합니다.
 * 새 이미지는 브라우저 object URL로 미리보기를 제공한 뒤 저장 시 Server Action으로 업로드합니다.
 */
export function AdminFeedbackReplyPanel({
  feedback,
}: AdminFeedbackReplyPanelProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(!feedback.reply);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [existingImagePaths, setExistingImagePaths] = useState(
    () => feedback.reply?.imagePaths ?? [],
  );
  const saveMutation = useSaveFeedbackReply();
  const deleteMutation = useDeleteFeedbackReply();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FeedbackReplyFormValues>({
    resolver: zodResolver(feedbackReplyFormSchema),
    defaultValues: {
      title: feedback.reply?.title ?? "",
      content: feedback.reply?.content ?? "",
    },
  });

  useEffect(() => {
    // 서버 데이터가 갱신되면 form과 이미지 편집 상태를 최신 답변 기준으로 재초기화한다.
    reset({
      title: feedback.reply?.title ?? "",
      content: feedback.reply?.content ?? "",
    });
    setExistingImagePaths(feedback.reply?.imagePaths ?? []);
    setPreviewImages((currentImages) => {
      currentImages.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
    setIsEditing(!feedback.reply);
  }, [feedback.reply, reset]);

  useEffect(
    () => () => {
      // blob: URL은 브라우저 메모리를 점유하므로 컴포넌트 해제 시 반드시 정리한다.
      previewImages.forEach((image) => URL.revokeObjectURL(image.url));
    },
    [previewImages],
  );

  const existingImages = useMemo(
    () =>
      // 수정 중 제거한 기존 이미지는 저장 전에도 preview 목록에서 숨긴다.
      feedback.reply?.images.filter((image) =>
        existingImagePaths.includes(image.path),
      ) ?? [],
    [existingImagePaths, feedback.reply?.images],
  );

  const imageCount = existingImagePaths.length + previewImages.length;
  const fileAccept = FEEDBACK_REPLY_ALLOWED_TYPES.join(",");
  const generalError =
    saveMutation.data?.ok === false
      ? saveMutation.data.message
      : deleteMutation.data?.ok === false
        ? deleteMutation.data.message
        : null;

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const remainingCount = FEEDBACK_REPLY_MAX_IMAGE_COUNT - imageCount;
    // 제한 개수를 넘긴 파일은 UI에 추가하지 않고 Server Action 검증에도 보내지 않는다.
    const nextFiles = files.slice(0, Math.max(0, remainingCount));

    setPreviewImages((currentImages) => [
      ...currentImages,
      ...nextFiles.map((file) => ({
        id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);

    event.target.value = "";
  }

  function handlePreviewRemove(id: string) {
    setPreviewImages((currentImages) => {
      const target = currentImages.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.url);

      return currentImages.filter((image) => image.id !== id);
    });
  }

  function handleExistingImageRemove(path: string) {
    setExistingImagePaths((currentPaths) =>
      currentPaths.filter((currentPath) => currentPath !== path),
    );
  }

  async function handleReplySubmit(values: FeedbackReplyFormValues) {
    const formData = new FormData();

    // 기존 이미지 path와 새 File을 분리해 보내면 Server Action이 유지/추가/삭제를 판별할 수 있다.
    formData.set("title", values.title);
    formData.set("content", values.content);
    existingImagePaths.forEach((path) =>
      formData.append("existingImagePaths", path),
    );
    previewImages.forEach((image) => formData.append("images", image.file));

    const result = await saveMutation.mutateAsync({
      feedbackId: feedback.id,
      formData,
    });

    if (result.ok) {
      setIsEditing(false);
      router.refresh();
    }
  }

  /**
   * 관리자 답변과 연결된 Storage 이미지를 삭제합니다.
   */
  async function handleReplyDelete() {
    const result = await deleteMutation.mutateAsync(feedback.id);

    if (result.ok) {
      setIsEditing(true);
      router.refresh();
    }
  }

  return (
    <aside className="min-w-0">
      <Card className="rounded-md lg:sticky lg:top-6">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>관리자 답변</CardTitle>
            {feedback.reply && !isEditing ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil aria-hidden="true" />
                  수정
                </Button>

                <AdminAlertDialog
                  trigger={
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 aria-hidden="true" />
                      삭제
                    </Button>
                  }
                  title="관리자 답변을 삭제하시겠습니까?"
                  description="삭제된 답변과 첨부 이미지는 복구할 수 없습니다. 피드백 상태는 미해결로 변경됩니다."
                  confirmLabel="삭제"
                  confirmVariant="destructive"
                  reverseActions
                  pending={deleteMutation.isPending}
                  onConfirm={handleReplyDelete}
                />
              </div>
            ) : null}
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="pt-6">
          {isEditing ? (
            <form
              className="space-y-5"
              onSubmit={handleSubmit(handleReplySubmit)}
            >
              <div className="space-y-2">
                <Label htmlFor="reply-title">제목</Label>
                <Input
                  id="reply-title"
                  maxLength={100}
                  placeholder="답변 제목"
                  disabled={saveMutation.isPending}
                  {...register("title")}
                />
                {errors.title ? (
                  <p className="text-sm text-destructive">
                    {errors.title.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reply-content">내용</Label>
                <Textarea
                  id="reply-content"
                  rows={10}
                  placeholder="사용자에게 전달할 답변을 입력하세요."
                  disabled={saveMutation.isPending}
                  {...register("content")}
                />
                {errors.content ? (
                  <p className="text-sm text-destructive">
                    {errors.content.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="reply-images">이미지</Label>
                  <span className="text-xs text-muted-foreground">
                    {imageCount}/{FEEDBACK_REPLY_MAX_IMAGE_COUNT}
                  </span>
                </div>

                <Input
                  id="reply-images"
                  type="file"
                  accept={fileAccept}
                  multiple
                  disabled={
                    saveMutation.isPending ||
                    imageCount >= FEEDBACK_REPLY_MAX_IMAGE_COUNT
                  }
                  onChange={handleImageChange}
                />

                {existingImages.length > 0 || previewImages.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {existingImages.map((image) => (
                      <ImagePreview
                        key={image.path}
                        src={image.signedUrl}
                        label="기존 답변 이미지"
                        onRemove={() => handleExistingImageRemove(image.path)}
                      />
                    ))}

                    {previewImages.map((image) => (
                      <ImagePreview
                        key={image.id}
                        src={image.url}
                        label={image.file.name}
                        onRemove={() => handlePreviewRemove(image.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              {generalError ? (
                <p className="text-sm text-destructive">{generalError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                {feedback.reply ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saveMutation.isPending}
                    onClick={() => {
                      reset({
                        title: feedback.reply?.title ?? "",
                        content: feedback.reply?.content ?? "",
                      });
                      setExistingImagePaths(feedback.reply?.imagePaths ?? []);
                      setPreviewImages((currentImages) => {
                        currentImages.forEach((image) =>
                          URL.revokeObjectURL(image.url),
                        );
                        return [];
                      });
                      setIsEditing(false);
                    }}
                  >
                    취소
                  </Button>
                ) : null}

                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "저장 중..." : "답변 저장"}
                </Button>
              </div>
            </form>
          ) : feedback.reply ? (
            <div className="space-y-5">
              <div>
                <h3 className="font-medium">{feedback.reply.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  마지막 수정 {formatDateTime(feedback.reply.updatedAt)}
                </p>
              </div>

              <div className="whitespace-pre-wrap rounded-md bg-muted/30 p-4 text-sm leading-6">
                {feedback.reply.content}
              </div>

              {feedback.reply.images.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {feedback.reply.images.map((image) => (
                    <a
                      key={image.path}
                      href={image.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-md border bg-muted"
                    >
                      <Image
                        src={image.signedUrl}
                        alt="관리자 답변 첨부 이미지"
                        width={360}
                        height={240}
                        className="aspect-video w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                아직 등록된 관리자 답변이 없습니다.
              </p>
              <Button
                type="button"
                className="mt-4"
                onClick={() => setIsEditing(true)}
              >
                <Plus aria-hidden="true" />
                답변 작성
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

/**
 * 기존 signed URL 이미지와 새 blob preview 이미지를 같은 형태로 표시합니다.
 */
function ImagePreview({
  src,
  label,
  onRemove,
}: {
  src: string;
  label: string;
  onRemove: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-md border bg-muted">
      <Image
        src={src}
        alt={label}
        width={360}
        height={240}
        className="aspect-video w-full object-cover"
        unoptimized={src.startsWith("blob:")}
      />
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute right-2 top-2 size-7"
        onClick={onRemove}
      >
        <X aria-hidden="true" />
        <span className="sr-only">이미지 제거</span>
      </Button>
    </div>
  );
}

/**
 * 답변 생성/수정 시각을 관리자 화면 표기 형식으로 변환합니다.
 */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
