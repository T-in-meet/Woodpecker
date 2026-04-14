import { beforeEach, describe, expect, it, vi } from "vitest";

import { issueAuthEmailLinkAndSend } from "@/features/auth/email/issueAuthEmailLinkAndSend";

import { resendVerificationEmail } from "./resendVerificationEmail";

vi.mock("@/features/auth/email/issueAuthEmailLinkAndSend");

const TEST_EMAIL = "test@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(issueAuthEmailLinkAndSend).mockResolvedValue(undefined);
});

describe("resendVerificationEmail", () => {
  it("TC-01. 재전송은 공용 유틸을 통해 magiclink 발급/전송을 요청한다", async () => {
    await resendVerificationEmail(TEST_EMAIL);

    expect(issueAuthEmailLinkAndSend).toHaveBeenCalledTimes(1);
    expect(issueAuthEmailLinkAndSend).toHaveBeenCalledWith({
      type: "magiclink",
      email: TEST_EMAIL,
    });
  });

  it("TC-02. 공용 유틸 실패를 상위로 전파한다", async () => {
    vi.mocked(issueAuthEmailLinkAndSend).mockRejectedValueOnce(
      new Error("send failed"),
    );

    await expect(resendVerificationEmail(TEST_EMAIL)).rejects.toThrow(
      "send failed",
    );
  });
});
