import { useMutation } from "@tanstack/react-query";

type SignupPayload = {
  email: string;
  password: string;
  nickname: string;
  termsOfService: boolean;
  privacyPolicy: boolean;
  avatarFile?: File | null;
};

type SignupSuccessResponse = {
  data: {
    redirectTo: string;
  };
};

export function useSignupMutation() {
  return useMutation<SignupSuccessResponse, Error, SignupPayload>({
    mutationFn: async (_payload) => {
      // TODO: implement API call
      throw new Error("Not implemented");
    },
  });
}
