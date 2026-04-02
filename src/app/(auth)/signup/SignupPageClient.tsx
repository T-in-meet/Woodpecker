"use client";

import { useRouter } from "next/navigation";

import { SignupForm } from "@/features/auth/components/SignupForm";
import { useSignupMutation } from "@/features/auth/hooks/useSignupMutation";

export default function SignupPageClient() {
  const router = useRouter();
  const { mutateAsync, isPending } = useSignupMutation();

  return (
    <SignupForm
      onSubmit={async (values) => {
        const { termsOfService, privacyPolicy, ...rest } = values;
        const response = await mutateAsync({
          ...rest,
          agreements: { termsOfService, privacyPolicy },
        });
        router.push(response.data.redirectTo);
      }}
      isPending={isPending}
    />
  );
}
