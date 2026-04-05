import { useMutation } from "@tanstack/react-query";

import { buildSignupRequestPayload } from "@/features/auth/signup/lib/buildSignupRequestPayload";

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
    email: string;
    redirectTo: string;
    signupAccountStatus: "active" | "pending";
  };
};

export function useSignupMutation() {
  return useMutation<SignupSuccessResponse, Error, SignupPayload>({
    mutationFn: async (payload) => {
      const request = buildSignupRequestPayload(payload);

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        ...(request.requestType === "json"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(request.body),
            }
          : { body: request.body }),
      });

      if (!response.ok) {
        throw new Error("Signup request failed");
      }

      return response.json() as Promise<SignupSuccessResponse>;
    },
  });
}
