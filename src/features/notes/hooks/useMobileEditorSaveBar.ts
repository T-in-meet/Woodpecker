"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";

/** Keep the editor selection above the sticky controls and software keyboard. */
export function useMobileEditorSaveBar() {
  const saveBarRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    const bar = saveBarRef.current;
    if (!bar || !editor) return;

    const originalMargin = editor.options.editorProps.scrollMargin ?? 5;
    const originalThreshold = editor.options.editorProps.scrollThreshold ?? 0;
    const viewport = window.visualViewport;
    let frame = 0;
    let lastGeometry = "";

    const update = () => {
      if (editor.isDestroyed) return;
      const mobile = window.innerWidth < 768;
      // Pinch zoom also shrinks visualViewport; it must not be treated as a keyboard.
      const keyboardInset =
        mobile && viewport && viewport.scale === 1
          ? Math.max(
              0,
              window.innerHeight - viewport.height - viewport.offsetTop,
            )
          : 0;
      // ProseMirror는 visualViewport.height를 기준으로 스크롤하므로
      // 키보드 높이는 저장바 위치에만 적용하고 여백에는 더하지 않는다.
      const bottom = mobile ? bar.getBoundingClientRect().height + 16 : 5;
      const geometry = `${mobile}:${keyboardInset}:${bottom}`;
      if (geometry === lastGeometry) return;
      lastGeometry = geometry;
      bar.style.bottom = mobile ? `${keyboardInset}px` : "";
      editor.setOptions({
        editorProps: {
          ...editor.options.editorProps,
          scrollMargin: mobile
            ? { top: 96, right: 5, bottom, left: 5 }
            : originalMargin,
          scrollThreshold: mobile
            ? { top: 96, right: 0, bottom, left: 0 }
            : originalThreshold,
        },
      });
      // Only move the document while the user is editing, never while browsing it.
      if (editor.isFocused) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          if (!editor.isDestroyed && editor.isFocused)
            editor.commands.scrollIntoView();
        });
      }
    };

    const observer = new ResizeObserver(update);
    observer.observe(bar);
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      bar.style.bottom = "";
      if (!editor.isDestroyed)
        editor.setOptions({
          editorProps: {
            ...editor.options.editorProps,
            scrollMargin: originalMargin,
            scrollThreshold: originalThreshold,
          },
        });
    };
  }, [editor]);

  return { saveBarRef, onEditorReady: setEditor };
}
