import { renderHook } from "@testing-library/react";
import { UseFormSetValue } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { consumeAuthEmailPrefillEmail } from "../lib/authEmailPrefillMemory";
import { AuthEmailFormInput } from "../schemas/authEmailFormSchema";
import { useAuthEmailPrefill } from "./useAuthEmailPrefill";

vi.mock("../lib/authEmailPrefillMemory", () => ({
  consumeAuthEmailPrefillEmail: vi.fn(),
}));

describe("useAuthEmailPrefill", () => {
  const mockedConsumeAuthEmailPrefillEmail = vi.mocked(
    consumeAuthEmailPrefillEmail,
  );

  const setup = () => {
    const setValue = vi.fn() as unknown as UseFormSetValue<AuthEmailFormInput>;

    renderHook(() => useAuthEmailPrefill({ setValue }));

    return { setValue };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefill 이메일이 있으면 form email 값으로 주입한다", () => {
    mockedConsumeAuthEmailPrefillEmail.mockReturnValue("test@example.com");

    const { setValue } = setup();

    expect(setValue).toHaveBeenCalledWith("email", "test@example.com", {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });
  });

  it("prefill 이메일이 없으면 form 값을 주입하지 않는다", () => {
    mockedConsumeAuthEmailPrefillEmail.mockReturnValue(null);

    const { setValue } = setup();

    expect(setValue).not.toHaveBeenCalled();
  });

  it("prefill 이메일이 유효하지 않으면 form 값을 주입하지 않는다", () => {
    mockedConsumeAuthEmailPrefillEmail.mockReturnValue("invalid-email");

    const { setValue } = setup();

    expect(setValue).not.toHaveBeenCalled();
  });

  it("리렌더링되어도 prefill 값을 다시 소비하지 않는다", () => {
    mockedConsumeAuthEmailPrefillEmail.mockReturnValue("test@example.com");

    const setValue = vi.fn() as unknown as UseFormSetValue<AuthEmailFormInput>;

    const { rerender } = renderHook(() =>
      useAuthEmailPrefill({
        setValue,
      }),
    );

    rerender();

    expect(mockedConsumeAuthEmailPrefillEmail).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledTimes(1);
  });
});
