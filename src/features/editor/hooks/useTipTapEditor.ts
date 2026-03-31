import { type Editor, useEditor } from "@tiptap/react";
import { useEffect, useMemo, useRef } from "react";

import { serializeTipTapMarkdown } from "@/features/editor/utils/serializeTipTapMarkdown";
import { getTipTapExtensions } from "@/features/editor/utils/tiptapExtensions";

type UseTipTapEditorOptions = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  readOnly?: boolean;
  autoFocus?: boolean;
};

export function useTipTapEditor({
  value,
  onChange,
  placeholder,
  readOnly = false,
  autoFocus = false,
}: UseTipTapEditorOptions): Editor | null {
  const onChangeRef = useRef(onChange);
  const skipNextUpdate = useRef(true);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const extensions = useMemo(
    () => getTipTapExtensions({ placeholder }),
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    onCreate() {
      skipNextUpdate.current = false;
    },
    onUpdate({ editor }) {
      if (skipNextUpdate.current) return;
      onChangeRef.current(serializeTipTapMarkdown(editor));
    },
  });

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (serializeTipTapMarkdown(editor) === value) return;

    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return editor;
}
