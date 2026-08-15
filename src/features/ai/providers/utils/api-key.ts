import {
  AI_MODEL_PROVIDER,
  type AiModelProvider,
} from "../../constants/models";

/**
 * Provider별 API key를 환경 변수에서 조회합니다.
 *
 * @param provider AI model provider
 * @returns Provider API key
 */
export function getProviderApiKey(provider: AiModelProvider): string {
  switch (provider) {
    case AI_MODEL_PROVIDER.GOOGLE: {
      const apiKey = process.env.GOOGLE_API_KEY;

      if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is not configured.");
      }

      return apiKey;
    }

    case AI_MODEL_PROVIDER.OPENAI: {
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      return apiKey;
    }
  }
}
