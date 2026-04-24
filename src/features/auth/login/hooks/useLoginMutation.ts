import { useMutation } from "@tanstack/react-query";

import { loginMutation, type LoginPayload } from "../mutations/loginMutation";

type LoginMutationVariables = {
  payload: LoginPayload;
  redirect?: string;
};

// useMutation은 단일 variables만 받기 때문에 payload/redirect를 객체로 래핑
export function useLoginMutation() {
  return useMutation({
    mutationFn: ({ payload, redirect }: LoginMutationVariables) =>
      loginMutation(payload, redirect),
  });
}
