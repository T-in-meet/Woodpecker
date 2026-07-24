"use client";

import "yet-another-react-lightbox/styles.css";

import Lightbox from "yet-another-react-lightbox";

import type { AdminLightboxImage } from "@/features/admin/types/lightbox";

interface AdminImageLightboxProps {
  /** Lightbox에 표시할 이미지 목록 */
  images: readonly AdminLightboxImage[];

  /** Lightbox 열림 여부 */
  open: boolean;

  /** 처음 표시할 이미지의 인덱스 */
  index: number;

  /** Lightbox 닫기 콜백 */
  onClose: () => void;
}

/**
 * 관리자 화면에서 공통으로 사용하는 이미지 Lightbox입니다.
 *
 * 썸네일 목록과 클릭 UI는 각 사용처에서 구성하며,
 * 이 컴포넌트는 확대 이미지와 슬라이드 표시만 담당합니다.
 */
export function AdminImageLightbox({
  images,
  open,
  index,
  onClose,
}: AdminImageLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={images.map((image) => ({
        src: image.src,
        alt: image.alt,
      }))}
    />
  );
}
