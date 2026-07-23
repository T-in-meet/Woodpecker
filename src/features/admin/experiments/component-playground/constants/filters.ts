import type { AdminFilterDefinition } from "@/features/admin/types/filter";

/**
 * Component Playground에서 검증할 수 있는 필터 필드 목록입니다.
 */
export type ComponentPlaygroundFilterField =
  | "status"
  | "roles"
  | "grade"
  | "score"
  | "createdAt";

/**
 * Component Playground에서 제공하는 관리자 사용자 필터 정의입니다.
 *
 * 현재 단계에서는 각 필터를 선택할 수 있는지만 확인하며,
 * 실제 값 입력과 목록 필터링은 이후 Editor 구현 단계에서 연결합니다.
 */
export const COMPONENT_PLAYGROUND_FILTERS = [
  {
    field: "status",
    label: "상태",
    type: "multi-select",
    placeholder: "상태를 선택하세요.",
    options: [
      {
        value: "active",
        label: "활성",
      },
      {
        value: "inactive",
        label: "비활성",
      },
      {
        value: "suspended",
        label: "정지",
      },
    ],
  },
  {
    field: "roles",
    label: "역할",
    type: "multi-select",
    placeholder: "역할을 선택하세요.",
    options: [
      {
        value: "user",
        label: "사용자",
      },
      {
        value: "editor",
        label: "편집자",
      },
      {
        value: "manager",
        label: "매니저",
      },
      {
        value: "admin",
        label: "관리자",
      },
    ],
  },
  {
    field: "grade",
    label: "등급",
    type: "select",
    placeholder: "등급을 선택하세요.",
    options: [
      {
        value: "basic",
        label: "일반",
      },
      {
        value: "premium",
        label: "프리미엄",
      },
      {
        value: "vip",
        label: "VIP",
      },
    ],
  },
  {
    field: "score",
    label: "점수",
    type: "number-range",
    placeholder: "점수 범위를 입력하세요.",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    field: "createdAt",
    label: "가입일",
    type: "date-range",
    placeholder: "가입일 범위를 선택하세요.",
  },
] as const satisfies readonly AdminFilterDefinition<ComponentPlaygroundFilterField>[];
