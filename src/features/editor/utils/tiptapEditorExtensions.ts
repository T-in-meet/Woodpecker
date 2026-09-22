import Placeholder from "@tiptap/extension-placeholder";

import { slashCommandSuggestionRender } from "../components/SlashCommandMenu";
import { SlashCommand } from "./slashCommand";
import { getBaseExtensions } from "./tiptapExtensions";

// 편집기 전용 확장. 읽기 전용 확장(getReadOnlyTipTapExtensions)은 서버에서도 쓰므로
// React 렌더러를 쓰는 슬래시 메뉴는 이 파일에서만 붙인다.
export function getTipTapExtensions({
  placeholder,
}: { placeholder?: string | undefined } = {}) {
  return [
    ...getBaseExtensions(),
    SlashCommand.configure({
      suggestion: slashCommandSuggestionRender(),
    }),
    ...(placeholder ? [Placeholder.configure({ placeholder })] : []),
  ];
}
