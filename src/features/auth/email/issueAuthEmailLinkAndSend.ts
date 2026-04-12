import { createAdminClient } from "@/lib/supabase/admin";

import { type AuthEmailType, sendAuthEmail } from "./sendAuthEmail";

type GenerateLinkParams = Parameters<
  ReturnType<typeof createAdminClient>["auth"]["admin"]["generateLink"]
>[0];

type IssueAuthEmailLinkAndSendInput = GenerateLinkParams & {
  email: string;
  type: AuthEmailType;
};

/**
 * Supabase Admin으로 auth link를 발급하고 커스텀 메일 발송까지 수행한다.
 *
 * 역할:
 * - 링크 발급(generateLink)
 * - hashed_token 추출
 * - nodemailer 기반 sendAuthEmail 호출
 *
 * 정책:
 * - auth 이메일 링크 타입은 magiclink 단일 정책을 따른다.
 */
export async function issueAuthEmailLinkAndSend(
  input: IssueAuthEmailLinkAndSendInput,
): Promise<void> {
  const adminClient = createAdminClient();
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink(input);

  if (linkError) {
    throw new Error(linkError.message);
  }

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Missing hashed_token from generateLink");
  }

  await sendAuthEmail(input.email, tokenHash, input.type);
}
