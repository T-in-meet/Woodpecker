import { useMutation } from "@tanstack/react-query";

import { loginMutation } from "../mutations/loginMutation";

export function useLoginMutation() {
  return useMutation({
    mutationFn: loginMutation,
  });
}
