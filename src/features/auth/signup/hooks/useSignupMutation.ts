import { useMutation } from "@tanstack/react-query";

import { signupMutation } from "../mutations/signupMutation";

/**
 * 회원가입 mutation 훅
 *
 * 역할:
 * - signupMutation을 TanStack Query의 useMutation으로 래핑
 * - 컴포넌트에서 쉽게 사용하도록 추상화
 *
 * 반환값:
 * - mutateAsync: 비동기 요청 실행 함수
 * - isPending: 요청 진행 상태 (로딩)
 * - error, data 등 TanStack Query 기본 상태 포함
 *
 * 사용 흐름:
 * 1. 컴포넌트에서 useSignupMutation 호출
 * 2. mutateAsync(payload) 실행
 * 3. 성공 시 → response 반환
 * 4. 실패 시 → error throw (폼에서 처리)
 *
 * 설계 의도:
 * - API 호출 로직(signupMutation)과 UI 로직 분리
 * - 테스트 시 mutation 단위로 독립 검증 가능
 */
export function useSignupMutation() {
  return useMutation({
    /**
     * 실제 API 호출 함수
     */
    mutationFn: signupMutation,
  });
}
