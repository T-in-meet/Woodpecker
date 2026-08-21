"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { recordCurrentLegalAcceptances } from "@/features/auth/lib/userAgreements";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

const acceptanceSchema = z.object({
  age14OrOlder: z.literal("on"),
  privacyPolicyAcknowledged: z.literal("on"),
  termsOfService: z.literal("on"),
});

export type AcceptLegalDocumentsState = {
  error?: string;
};

export async function acceptLegalDocumentsAction(
  redirectPath: string | null,
  _previousState: AcceptLegalDocumentsState,
  formData: FormData,
): Promise<AcceptLegalDocumentsState> {
  const parsed = acceptanceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error:
        "이용약관 동의, 개인정보 처리방침 확인, 만 14세 이상 확인이 모두 필요합니다.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(ROUTES.LOGIN);

  if (!user.email_confirmed_at) {
    const query = new URLSearchParams({ purpose: "signup" });
    if (user.email) query.set("email", user.email);
    redirect(`${ROUTES.RESEND_EMAIL}?${query.toString()}`);
  }

  try {
    await recordCurrentLegalAcceptances(user.id, "reconsent");
  } catch {
    return { error: "확인 기록을 저장하지 못했습니다. 다시 시도해주세요." };
  }

  redirect(validateRedirectPath(redirectPath));
}
