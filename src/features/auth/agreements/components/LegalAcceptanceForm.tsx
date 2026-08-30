"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AcceptLegalDocumentsState } from "@/features/auth/agreements/actions/acceptLegalDocumentsAction";
import {
  formatLegalDate,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_NOTICE_DATE,
} from "@/lib/constants/legal";
import { ROUTES } from "@/lib/constants/routes";

type LegalAcceptanceFormProps = {
  action: (
    state: AcceptLegalDocumentsState,
    formData: FormData,
  ) => Promise<AcceptLegalDocumentsState>;
  isEnforced: boolean;
};

export function LegalAcceptanceForm({
  action,
  isEnforced,
}: LegalAcceptanceFormProps) {
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <div className="mx-auto my-4 max-w-2xl overflow-hidden rounded-xl border bg-white shadow-sm">
      <form action={formAction} className="space-y-6 px-4 py-7 md:px-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            법적 문서 확인
          </h1>
          <p className="text-sm text-muted-foreground">
            개정 문서는 {formatLegalDate(LEGAL_NOTICE_DATE)}에 공개되며,{" "}
            {formatLegalDate(LEGAL_EFFECTIVE_DATE)}부터 적용됩니다.
            {isEnforced
              ? " 계속 이용하려면 아래 항목을 완료해주세요."
              : " 시행 전에 미리 확인하고 동의할 수 있습니다."}
          </p>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <Checkbox
              id="termsOfService"
              name="termsOfService"
              required
              className="cursor-pointer"
            />
            <Label
              htmlFor="termsOfService"
              className="cursor-pointer leading-5"
            >
              <Link
                href={ROUTES.TERMS}
                target="_blank"
                className="underline hover:text-primary"
              >
                이용약관
              </Link>
              에 동의합니다.
            </Label>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="privacyPolicyAcknowledged"
              name="privacyPolicyAcknowledged"
              required
              className="cursor-pointer"
            />
            <Label
              htmlFor="privacyPolicyAcknowledged"
              className="cursor-pointer leading-5"
            >
              <Link
                href={ROUTES.PRIVACY}
                target="_blank"
                className="underline hover:text-primary"
              >
                개인정보 처리방침
              </Link>
              을 읽고 확인했습니다.
            </Label>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="age14OrOlder"
              name="age14OrOlder"
              required
              className="cursor-pointer"
            />
            <Label htmlFor="age14OrOlder" className="cursor-pointer leading-5">
              만 14세 이상임을 확인합니다.
            </Label>
          </div>
        </div>

        {state.error ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "저장 중..." : "확인하고 계속하기"}
        </Button>
      </form>
    </div>
  );
}
