/**
 * Prompt template의 `{{variableName}}` placeholder를 변수 값으로 치환합니다.
 *
 * 변수 이름은 영문자, 숫자, underscore만 허용하며 placeholder에 공백이
 * 포함되어 있어도 동일한 변수 이름으로 인식합니다.
 *
 * 변수 객체에 존재하지 않는 placeholder는 원문 그대로 유지합니다.
 * 이를 통해 Prompt 작성 오류가 실행 시점에 조용히 빈 문자열로 변환되지 않고
 * snapshot 및 테스트에서 확인될 수 있도록 합니다.
 *
 * @param template 치환할 Prompt template 문자열입니다.
 * @param variables placeholder 이름과 치환할 문자열 값의 매핑입니다.
 * @returns placeholder가 변수 값으로 치환된 Prompt 문자열입니다.
 */
export function renderPromptTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(variables, key)
      ? (variables[key] ?? "")
      : match,
  );
}
