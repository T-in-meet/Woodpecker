import { useMutation } from "@tanstack/react-query";

import { buildSignupRequestPayload } from "@/features/auth/lib/buildSignupRequestPayload";

type SignupPayload = {
  email: string;
  password: string;
  nickname: string;
  agreements: {
    termsOfService: boolean;
    privacyPolicy: boolean;
  };
  avatarFile?: File | null;
};

type SignupSuccessResponse = {
  data: {
    redirectTo: string;
  };
};

export function useSignupMutation() {
  return useMutation<SignupSuccessResponse, Error, SignupPayload>({
    mutationFn: async (payload) => {
      const _request = buildSignupRequestPayload(payload);
      // TODO: implement API call
      throw new Error("Not implemented");
    },
  });
}
