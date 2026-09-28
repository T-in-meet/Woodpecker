import type { AnyExtension, JSONContent } from "@tiptap/core";
import { type Editor, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef } from "react";

import { serializeTipTapMarkdown } from "@/features/editor/utils/serializeTipTapMarkdown";
import { getTipTapExtensions } from "@/features/editor/utils/tiptapEditorExtensions";
import { getReadOnlyTipTapExtensions } from "@/features/editor/utils/tiptapExtensions";

// 기본 스키마의 빈 문서. 빈 문자열도 수행하던 Markdown → HTML → DOM 파싱을 건너뛴다.
const EMPTY_DOCUMENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

type UseTipTapEditorOptions = {
  value: string;
  onChange?: ((value: string) => void) | undefined;
  placeholder?: string | undefined;
  readOnly?: boolean;
  autoFocus?: boolean;
  extensions?: AnyExtension[] | undefined;
};

export function useTipTapEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  autoFocus = false,
  extensions: customExtensions,
}: UseTipTapEditorOptions): Editor | null {
  const onChangeRef = useRef(onChange);
  const skipNextUpdate = useRef(true);
  const lastSerializedValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () =>
      customExtensions ??
      (readOnly
        ? getReadOnlyTipTapExtensions()
        : getTipTapExtensions({ placeholder })),
    [customExtensions, placeholder, readOnly],
  );

  const editor = useEditor({
    extensions,
    // 사용자 지정 확장은 paragraph가 없는 스키마일 수 있으므로 원래 입력을 유지한다.
    content: value === "" && !customExtensions ? EMPTY_DOCUMENT : value,
    editable: !readOnly,
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    onCreate() {
      lastSerializedValueRef.current = value;
      skipNextUpdate.current = false;
    },
    onUpdate({ editor }) {
      if (skipNextUpdate.current) return;
      const nextValue = serializeTipTapMarkdown(editor);

      if (lastSerializedValueRef.current === nextValue) return;

      lastSerializedValueRef.current = nextValue;
      onChangeRef.current?.(nextValue);
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (lastSerializedValueRef.current === value) return;

    lastSerializedValueRef.current = value;
    // setContent는 현재 TipTap에서 동기적으로 onUpdate를 호출하므로 flag 기반 skip이 동작한다.
    skipNextUpdate.current = true;
    editor.commands.setContent(value);
    queueMicrotask(() => {
      skipNextUpdate.current = false;
    });
  }, [editor, value]);

  return editor;
}
