import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from "@codemirror/language";
import { go } from "@codemirror/legacy-modes/mode/go";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import type { Extension } from "@codemirror/state";

import type { SupportedLanguage } from "@/features/editor/config";

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
  }
}

export const LANGUAGE_DESCRIPTIONS: LanguageDescription[] = [
  LanguageDescription.of({
    name: "JavaScript",
    alias: ["js", "jsx", "mjs", "cjs"],
    load: () =>
      import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ jsx: true }),
      ),
  }),
  LanguageDescription.of({
    name: "TypeScript",
    alias: ["ts", "tsx"],
    load: () =>
      import("@codemirror/lang-javascript").then((m) =>
        m.javascript({ jsx: true, typescript: true }),
      ),
  }),
  LanguageDescription.of({
    name: "Python",
    alias: ["py"],
    load: () => import("@codemirror/lang-python").then((m) => m.python()),
  }),
  LanguageDescription.of({
    name: "Rust",
    alias: ["rs"],
    // static import로 이미 번들에 포함되므로 동기 로드
    support: new LanguageSupport(StreamLanguage.define(rust)),
  }),
  LanguageDescription.of({
    name: "Go",
    alias: ["golang"],
    // static import로 이미 번들에 포함되므로 동기 로드
    support: new LanguageSupport(StreamLanguage.define(go)),
  }),
  LanguageDescription.of({
    name: "Shell",
    alias: ["bash", "sh", "shell", "zsh"],
    load: async () => {
      const { shell: shellMode } =
        await import("@codemirror/legacy-modes/mode/shell");
      return new LanguageSupport(StreamLanguage.define(shellMode));
    },
  }),
];
