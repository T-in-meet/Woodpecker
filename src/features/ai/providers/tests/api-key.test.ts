import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_MODEL_PROVIDER } from "../../constants/models";
import { getProviderApiKey } from "../utils/api-key";

describe("getProviderApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("OpenAI Provider의 API key를 반환한다", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-api-key");

    expect(getProviderApiKey(AI_MODEL_PROVIDER.OPENAI)).toBe(
      "test-openai-api-key",
    );
  });

  it("Google Provider의 API key를 반환한다", () => {
    vi.stubEnv("GOOGLE_API_KEY", "test-google-api-key");

    expect(getProviderApiKey(AI_MODEL_PROVIDER.GOOGLE)).toBe(
      "test-google-api-key",
    );
  });

  it("OPENAI_API_KEY가 설정되지 않으면 오류를 발생시킨다", () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(() => getProviderApiKey(AI_MODEL_PROVIDER.OPENAI)).toThrow(
      "OPENAI_API_KEY is not configured.",
    );
  });

  it("GOOGLE_API_KEY가 설정되지 않으면 오류를 발생시킨다", () => {
    vi.stubEnv("GOOGLE_API_KEY", "");

    expect(() => getProviderApiKey(AI_MODEL_PROVIDER.GOOGLE)).toThrow(
      "GOOGLE_API_KEY is not configured.",
    );
  });
});
