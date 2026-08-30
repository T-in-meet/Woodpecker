import { z } from "zod";

import { AGREEMENT_REQUIRED_PATH } from "@/features/auth/constants/agreementRequired";

function isAgreementRedirectPath(value: string): boolean {
  try {
    const url = new URL(value, "http://localhost");

    return (
      url.origin === "http://localhost" &&
      url.pathname === AGREEMENT_REQUIRED_PATH &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

export const legalAcceptanceRequiredResponseSchema = z.object({
  error: z.literal("legal_acceptance_required"),
  redirectTo: z.string().refine(isAgreementRedirectPath),
});
