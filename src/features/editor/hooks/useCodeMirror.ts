import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers,
} from "@codemirror/view";
import { useEffect, useRef } from "react";

import type { SupportedLanguage } from "@/features/editor/config";
import { getLanguageExtension } from "@/features/editor/utils/getLanguageExtension";

interface UseCodeMirrorOptions {
  doc: string;
  language: SupportedLanguage;
  onChange: (value: string) => void;
}

export function useCodeMirror({
  doc,
  language,
  onChange,
}: UseCodeMirrorOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        languageCompartment.current.of(getLanguageExtension(language)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    editorViewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: languageCompartment.current.reconfigure(
        getLanguageExtension(language),
      ),
    });
  }, [language]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (doc === view.state.doc.toString()) return;

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: doc },
    });
  }, [doc]);

  return { containerRef };
}
