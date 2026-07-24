import type { AdminLightboxImage } from "@/features/admin/types/lightbox";

/**
 * Component Playground에서 사용하는 관리자 Lightbox 테스트 이미지입니다.
 *
 * 실제 Storage 대신 public 디렉터리의 정적 이미지를 사용하여
 * 슬라이드, 확대, 키보드 이동 등의 동작을 검증합니다.
 */
export const COMPONENT_PLAYGROUND_LIGHTBOX_IMAGES = [
  {
    src: "/images/lightbox/lightbox-test-1.jpg",
    alt: "Lightbox 테스트 이미지 1",
  },
  {
    src: "/images/lightbox/lightbox-test-2.jpg",
    alt: "Lightbox 테스트 이미지 2",
  },
  // {
  //   src: "/images/lightbox/lightbox-test-3.jpg",
  //   alt: "Lightbox 테스트 이미지 3",
  // },
  // {
  //   src: "/images/lightbox/lightbox-test-4.webp",
  //   alt: "Lightbox 테스트 이미지 4",
  // },
  // {
  //   src: "/images/lightbox/lightbox-test-5.webp",
  //   alt: "Lightbox 테스트 이미지 5",
  // },
] satisfies readonly AdminLightboxImage[];
