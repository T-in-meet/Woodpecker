import { history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { useEffect, useRef } from "react";

import {
  getAriaLabelExtension,
  getMarkdownTabIndentResult,
  getPlaceholderExtension,
  getReadOnlyExtension,
} from "@/features/editor/utils/editorExtensions";
import {
  EXTERNAL_SYNC_ANNOTATION,
  getDocumentChange,
} from "@/features/editor/utils/getDocumentChange";
import { LANGUAGE_DESCRIPTIONS } from "@/features/editor/utils/getLanguageExtension";

type UseMarkdownEditorOptions = {
  doc: string;
  onChange: (value: string) => void;
  placeholder?: string | undefined;
  readOnly?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string | undefined;
};

export function useMarkdownEditor({
  doc,
  onChange,
  placeholder: placeholderText,
  readOnly = false,
  autoFocus = false,
  ariaLabel,
}: UseMarkdownEditorOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const readOnlyCompartment = useRef(new Compartment());
  const placeholderCompartment = useRef(new Compartment());
  const ariaLabelCompartment = useRef(new Compartment());

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc,
      extensions: [
        syntaxHighlighting(defaultHighlightStyle),
        EditorView.lineWrapping,
        markdown({
          base: markdownLanguage,
          codeLanguages: LANGUAGE_DESCRIPTIONS,
        }),
        readOnlyCompartment.current.of(getReadOnlyExtension(readOnly)),
        placeholderCompartment.current.of(
          getPlaceholderExtension(placeholderText),
        ),
        ariaLabelCompartment.current.of(getAriaLabelExtension(ariaLabel)),
        history(),
        keymap.of([
          ...historyKeymap,
          {
            key: "Tab",
            run: (view) => {
              if (view.state.readOnly) return false;
              view.dispatch(
                view.state.changeByRange((range) =>
                  getMarkdownTabIndentResult(view.state, range),
                ),
              );
              return true;
            },
          },
        ]),
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

    if (autoFocus) {
      requestAnimationFrame(() => {
        editorViewRef.current?.focus();
      });
    }

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
      effects: readOnlyCompartment.current.reconfigure(
        getReadOnlyExtension(readOnly),
      ),
    });
  }, [readOnly]);

  useEffect(() => {
    editorViewRef.current?.dispatch({
      effects: placeholderCompartment.current.reconfigure(
        getPlaceholderExtension(placeholderText),
      ),
    });
  }, [placeholderText]);

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

  const toggleFormat = (syntax: string) => {
    const view = editorViewRef.current;
    if (!view || view.state.readOnly) return;

    const { state } = view;
    const { from, to } = state.selection.main;
    const len = syntax.length;
    const selectedText = state.sliceDoc(from, to);
    const before = from >= len ? state.sliceDoc(from - len, from) : "";
    const after = state.sliceDoc(to, to + len);

    if (before === syntax && after === syntax) {
      view.dispatch({
        changes: [
          { from: from - len, to: from, insert: "" },
          { from: to, to: to + len, insert: "" },
        ],
        selection: { anchor: from - len, head: to - len },
      });
    } else if (selectedText) {
      view.dispatch({
        changes: { from, to, insert: `${syntax}${selectedText}${syntax}` },
        selection: { anchor: from + len, head: to + len },
      });
    } else {
      view.dispatch({
        changes: { from, insert: `${syntax}${syntax}` },
        selection: { anchor: from + len },
      });
    }
    view.focus();
  };

  return {
    containerRef,
    toggleBold: () => toggleFormat("**"),
    toggleItalic: () => toggleFormat("*"),
    toggleStrikethrough: () => toggleFormat("~~"),
    toggleCode: () => toggleFormat("`"),
  };
}
