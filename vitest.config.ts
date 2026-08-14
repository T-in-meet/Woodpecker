import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { configDefaults, defineConfig } from "vitest/config";

const JSDOM_TEST_FILES = [
  "**/*.test.tsx",
  "src/app/api/auth/signup/tests/route.rate-limit.test.ts",
  "src/features/auth/hooks/useAuthEmailActionEffect.test.ts",
  "src/features/auth/hooks/useAuthEmailPrefill.test.ts",
  "src/features/auth/lib/tests/validateRedirectPath/validateRedirectPath.contract.test.ts",
  "src/features/editor/tests/blockActions.test.ts",
  "src/features/editor/tests/blockDrag.test.ts",
  "src/features/editor/tests/noteColor.test.ts",
  "src/features/editor/tests/tiptap-roundtrip.test.ts",
  "src/features/editor/tests/tiptapExtensions.test.ts",
  "src/features/quiz/tests/useQuiz.test.ts",
  "src/hooks/tests/use-mobile.test.ts",
  "src/hooks/tests/useNotesView.test.ts",
  "src/hooks/tests/usePreventPageLeave.test.ts",
] as const;

const TEST_EXCLUDES = [...configDefaults.exclude, "tests/e2e/**"];

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": resolve(__dirname, "./src"),
          },
        },
        test: {
          name: "node",
          environment: "node",
          globals: true,
          pool: "threads",
          include: ["**/*.test.ts"],
          exclude: [...TEST_EXCLUDES, ...JSDOM_TEST_FILES],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: {
            "@": resolve(__dirname, "./src"),
          },
        },
        test: {
          name: "jsdom",
          environment: "jsdom",
          globals: true,
          pool: "threads",
          setupFiles: ["./src/tests/setup.ts"],
          include: [...JSDOM_TEST_FILES],
          exclude: TEST_EXCLUDES,
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
