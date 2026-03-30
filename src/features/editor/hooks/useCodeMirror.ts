import { history, historyKeymap } from "@codemirror/commands";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";

import type { SupportedLanguage } from "@/features/editor/supportedLanguages";
import { getAriaLabelExtension } from "@/features/editor/utils/editorExtensions";
import {
  EXTERNAL_SYNC_ANNOTATION,
  getDocumentChange,
} from "@/features/editor/utils/getDocumentChange";
import { getLanguageExtension } from "@/features/editor/utils/getLanguageExtension";

type UseCodeMirrorOptions = {
  doc: string;
  language: SupportedLanguage;
  onChange: (value: string) => void;
  ariaLabel?: string | undefined;
};

export function useCodeMirror({
  doc,
  language,
  onChange,
  ariaLabel,
}: UseCodeMirrorOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const ariaLabelCompartment = useRef(new Compartment());
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc,
      extensions: [
        syntaxHighlighting(defaultHighlightStyle),
        history(),
        keymap.of(historyKeymap),
        languageCompartment.current.of(getLanguageExtension(language)),
        ariaLabelCompartment.current.of(getAriaLabelExtension(ariaLabel)),
        EditorView.updateListener.of((update) => {
          const isExternalSync = update.transactions.some((transaction) =>
            transaction.annotation(EXTERNAL_SYNC_ANNOTATION),
          );

          if (update.docChanged && !isExternalSync) {
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
      effects: ariaLabelCompartment.current.reconfigure(
        getAriaLabelExtension(ariaLabel),
      ),
    });
  }, [ariaLabel]);

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
    const currentDoc = view.state.doc.toString();
    const changes = getDocumentChange(currentDoc, doc);

    if (!changes) return;

    view.dispatch({
      changes,
      annotations: EXTERNAL_SYNC_ANNOTATION.of(true),
    });
  }, [doc]);

  return { containerRef };
}
