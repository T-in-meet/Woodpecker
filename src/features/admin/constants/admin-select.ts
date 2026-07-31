/**
 * 관리자 페이지에서 사용하는 Select 컴포넌트의 기본 설정입니다.
 *
 * Radix SelectContent의 기본 `position`은 `item-aligned`이며,
 * 선택된 항목이 Trigger 위치와 겹치도록 정렬될 수 있습니다.
 *
 * 관리자 페이지에서는 일반적인 Dropdown 형태로 Trigger 아래에 표시하기 위해
 * SelectContent의 위치 지정 방식을 `popper`로 통일합니다.
 *
 * Dropdown 위치를 추가로 조절해야 할 경우 `content`에 다음 속성을 추가합니다.
 *
 * - `side`: Dropdown이 열리는 방향
 *   (`"top" | "right" | "bottom" | "left"`)
 * - `align`: Trigger를 기준으로 한 정렬 위치
 *   (`"start" | "center" | "end"`)
 * - `sideOffset`: Trigger와 Dropdown 사이의 간격
 * - `alignOffset`: 기준 정렬 위치에서 좌우 또는 상하로 이동할 거리
 * - `avoidCollisions`: 화면 경계에 닿을 때 위치를 자동으로 변경할지 여부
 */
export const ADMIN_SELECT_DEFAULTS = {
  content: {
    position: "popper" as const,
  },
};
