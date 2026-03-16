import { create } from "zustand";

interface EditorStore {
  content: string;
  language: string;
  setContent: (content: string) => void;
  setLanguage: (language: string) => void;
  reset: () => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  content: "",
  language: "typescript",
  setContent: (content) => set({ content }),
  setLanguage: (language) => set({ language }),
  reset: () => set({ content: "", language: "typescript" }),
}));
