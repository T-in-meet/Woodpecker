import { useMutation } from "@tanstack/react-query";

import { resendVerificationEmailMutation } from "../mutations/resendVerificationEmailMutation";

/**
 * 인증 메일 재전송 mutation 훅
 *
 * 역할:
 * - resendVerificationEmailMutation을 TanStack Query의 useMutation으로 래핑
 * - 컴포넌트에서 쉽게 사용하도록 추상화
 *
 * 반환값:
 * - mutateAsync: 비동기 요청 실행 함수
 * - isPending: 요청 진행 상태 (로딩)
 * - error, data 등 TanStack Query 기본 상태 포함
 *
 * 사용 흐름:
 * 1. 컴포넌트에서 useResendVerificationEmailMutation 호출
 * 2. mutateAsync(payload) 실행
 * 3. 성공 시 → response 반환
 * 4. 실패 시 → error throw (UI에서 처리)
 *
 * 설계 의도:
 * - API 호출 로직(resendVerificationEmailMutation)과 UI 로직 분리
 * - SignupForm과 동일한 패턴으로 구조 통일
 * - 테스트 시 mutation 단위로 독립 검증 가능
 */
export function useResendVerificationEmailMutation() {
  return useMutation({
    /**
     * 실제 API 호출 함수
     */
    mutationFn: resendVerificationEmailMutation,
  });
}
