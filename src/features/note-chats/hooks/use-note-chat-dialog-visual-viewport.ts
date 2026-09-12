"use client";

import { useEffect, useState } from "react";

const DIALOG_VIEWPORT_MARGIN_PX = 16;

export type NoteChatDialogViewportStyle = {
  top: number;
  maxHeight: number;
};

/**
 * 터치 환경에서 소프트 키보드가 열린 경우
 * Note Chat Dialog를 현재 visual viewport 안에 배치하기 위한 스타일을 반환합니다.
 *
 * Visual Viewport API를 지원하지 않거나 coarse pointer 환경이 아니면
 * 공통 Dialog의 기존 배치를 그대로 사용하도록 null을 반환합니다.
 *
 * @param open Dialog 열림 상태
 * @returns visual viewport 기준 Dialog 위치와 최대 높이
 */
export function useNoteChatDialogVisualViewport(open: boolean) {
  const [dialogViewportStyle, setDialogViewportStyle] =
    useState<NoteChatDialogViewportStyle | null>(null);

  useEffect(() => {
    if (!open) {
      setDialogViewportStyle(null);
      return;
    }

    if (!window.matchMedia("(pointer: coarse)").matches) {
      setDialogViewportStyle(null);
      return;
    }

    const visualViewport = window.visualViewport;

    if (!visualViewport) {
      setDialogViewportStyle(null);
      return;
    }

    let animationFrameId: number | null = null;

    const updateDialogViewport = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        setDialogViewportStyle({
          top: visualViewport.offsetTop + visualViewport.height / 2,
          maxHeight: Math.max(
            visualViewport.height - DIALOG_VIEWPORT_MARGIN_PX * 2,
            0,
          ),
        });

        animationFrameId = null;
      });
    };

    updateDialogViewport();

    visualViewport.addEventListener("resize", updateDialogViewport);
    visualViewport.addEventListener("scroll", updateDialogViewport);

    return () => {
      visualViewport.removeEventListener("resize", updateDialogViewport);
      visualViewport.removeEventListener("scroll", updateDialogViewport);

      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [open]);

  return dialogViewportStyle;
}
