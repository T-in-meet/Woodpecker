import type { Metadata } from "next";
import { redirect as nextRedirect } from "next/navigation";
import { Suspense } from "react";

import { RESET_PASSWORD_INTENT_CLEANUP_PATH } from "@/features/auth/constants/routes";
import {
  readSignedResetPasswordIntent,
  verifyResetPasswordIntent,
} from "@/features/auth/lib/signedResetPasswordIntent";
import { resetPasswordAction } from "@/features/auth/reset-password/actions/resetPasswordAction";
import { ResetPasswordForm } from "@/features/auth/reset-password/components/ResetPasswordForm";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const user = await getUser();

  if (!user) {
    nextRedirect(ROUTES.FORGOT_PASSWORD);
  }

  const resetPasswordIntent = await readSignedResetPasswordIntent();

  if (!resetPasswordIntent) {
    nextRedirect(ROUTES.FORGOT_PASSWORD);
  }

  const verifiedIntent = verifyResetPasswordIntent({
    token: resetPasswordIntent,
    expectedUserId: user.id,
  });

  if (!verifiedIntent) {
    nextRedirect(RESET_PASSWORD_INTENT_CLEANUP_PATH);
  }

  const { redirect: redirectQuery } = await searchParams;
  const redirectPath = redirectQuery ?? null;
  const resetPasswordFormAction = resetPasswordAction.bind(null, redirectPath);

  return (
    <Suspense fallback={null}>
      <ResetPasswordForm action={resetPasswordFormAction} />
    </Suspense>
  );
}
