import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";

export function getReadOnlyExtension(readOnly: boolean): Extension {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

export function getPlaceholderExtension(placeholderText?: string): Extension {
  return placeholderText ? placeholder(placeholderText) : [];
}
