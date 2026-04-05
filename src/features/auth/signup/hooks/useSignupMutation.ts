import { useMutation } from "@tanstack/react-query";

import { signupMutation } from "../mutations/signupMutation";

export function useSignupMutation() {
  return useMutation({
    mutationFn: signupMutation,
  });
}
