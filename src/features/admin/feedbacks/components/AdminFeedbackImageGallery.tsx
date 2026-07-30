"use client";

import Image from "next/image";
import { useState } from "react";

import { AdminImageLightbox } from "@/features/admin/components/common/AdminImageLightbox";
import type { AdminLightboxImage } from "@/features/admin/types/lightbox";

type AdminFeedbackImage = {
  /** Storage 내부 이미지 경로 */
  path: string;

  /** 이미지를 조회할 수 있는 signed URL */
  signedUrl: string;
};

type AdminFeedbackImageGalleryProps = {
  /** 사용자 피드백에 첨부된 이미지 목록 */
  images: readonly AdminFeedbackImage[];
};

/**
 * 관리자 피드백 상세 화면에서 사용자 첨부 이미지를 표시합니다.
 *
 * 썸네일을 선택하면 해당 이미지부터 Lightbox를 열고,
 * 나머지 첨부 이미지를 슬라이드로 탐색할 수 있습니다.
 */
export function AdminFeedbackImageGallery({
  images,
}: AdminFeedbackImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const lightboxImages = images.map(
    (image, index): AdminLightboxImage => ({
      src: image.signedUrl,
      alt: `사용자 첨부 이미지 ${index + 1}`,
    }),
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">사용자 첨부 이미지</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        {images.map((image, index) => (
          <button
            key={image.path}
            type="button"
            className="block overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setSelectedIndex(index)}
            aria-label={`사용자 첨부 이미지 ${index + 1} 크게 보기`}
          >
            <Image
              src={image.signedUrl}
              alt={`사용자 첨부 이미지 ${index + 1}`}
              width={640}
              height={360}
              className="aspect-video w-full object-cover transition-transform hover:scale-105"
            />
          </button>
        ))}
      </div>

      <AdminImageLightbox
        images={lightboxImages}
        open={selectedIndex !== null}
        index={selectedIndex ?? 0}
        onClose={() => setSelectedIndex(null)}
      />
    </div>
  );
}
