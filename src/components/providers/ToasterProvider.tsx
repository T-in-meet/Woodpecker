"use client";

import { Toaster } from "sonner";

/**
 * 전역 토스터 제공자
 *
 * sonner의 Toaster 컴포넌트를 전역에서 마운트하여
 * 모든 페이지에서 showToast() 호출 시 토스트가 표시될 수 있도록 한다.
 *
 * 설계:
 * - 정확히 한 개의 Toaster만 마운트됨 (루트 레이아웃에서)
 * - showToast()는 imperative 호출로 이를 트리거만 함
 * - 토스트 렌더링과 스택킹은 Toaster가 관리
 */
export function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      // [설명: Sonner는 기본적으로 화면 우측 하단에 토스트를 렌더링함.
      //  이는 shadcn/ui의 기본 토스트 위치와 일치]
      richColors
      // [설명: 토스트 색상을 자동으로 variant에 맞춰 설정함]
    />
  );
}
