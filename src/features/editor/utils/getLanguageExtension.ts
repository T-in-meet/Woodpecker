import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { StreamLanguage } from "@codemirror/language";
import { go } from "@codemirror/legacy-modes/mode/go";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import type { Extension } from "@codemirror/state";

import type { SupportedLanguage } from "@/features/editor/supportedLanguages";

export function getLanguageExtension(language: SupportedLanguage): Extension {
  switch (language) {
    case "javascript":
      return javascript({ jsx: false });
    case "typescript":
      return javascript({ typescript: true });
    case "python":
      return python();
    case "rust":
      return StreamLanguage.define(rust);
    case "go":
      return StreamLanguage.define(go);
    default: {
      const _exhaustive: never = language;
      return _exhaustive;
    }
  }
}
