import type { AiModelKey } from "../constants/models";
import type { AiTokenUsage } from "../providers/types";

/**
 * AI Model의 token 사용량 기반 비용 계산에 사용하는 가격 정보입니다.
 *
 * 가격은 백만 token당 USD 기준으로 관리합니다.
 */
type AiTokenPricing = {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
};

/**
 * AI 호출 비용 추정에 필요한 입력입니다.
 *
 * @property modelKey 비용을 계산할 AI Model의 key입니다.
 * @property usage Provider별 차이를 정규화한 token 사용량입니다.
 */
export type EstimateAiUsageCostInput = {
  modelKey: AiModelKey | string;
  usage: AiTokenUsage;
};

/**
 * AI 호출 비용 추정 결과입니다.
 *
 * 입력 token 비용, 출력 token 비용 및 두 비용의 합계를 USD 단위로 제공합니다.
 */
export type EstimateAiUsageCostResult = {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
};

/*
 * 현재 AI Foundation에서 사용하는 Model별 token 가격을 코드에 고정한다.
 *
 * 가격 정책이 변경되거나 지원 Model이 증가하면 이 목록을 직접 수정해야 한다.
 * TODO(#285): 향후 Model Config 또는 별도의 pricing 관리 영역으로 분리하여
 * Model 추가 및 가격 변경을 코드 배포 없이 관리할 수 있는 구조를 검토한다.
 */
const AI_MODEL_TOKEN_PRICING: Record<string, AiTokenPricing> = {
  "openai-gpt-4o-mini": {
    inputUsdPerMillionTokens: 0.15,
    outputUsdPerMillionTokens: 0.6,
  },
  "openai-text-embedding-3-small": {
    inputUsdPerMillionTokens: 0.02,
    outputUsdPerMillionTokens: 0,
  },
};

/**
 * 정규화된 AI token 사용량을 기준으로 예상 USD 비용을 계산합니다.
 *
 * 지원하지 않는 Model key가 전달되면 가격 정보가 없으므로 비용을 0으로 반환합니다.
 * 이는 비용 계산을 수행하는 호출 경로에서 가격 정보 부재가 AI 실행 자체를 실패시키지
 * 않도록 하기 위한 정책입니다.
 *
 * @param input 비용을 계산할 Model key와 정규화된 token 사용량입니다.
 * @returns 입력 token 비용, 출력 token 비용 및 총 비용을 USD로 반환합니다.
 */
export function estimateAiUsageCostUsd(
  input: EstimateAiUsageCostInput,
): EstimateAiUsageCostResult {
  const pricing = AI_MODEL_TOKEN_PRICING[input.modelKey];

  /*
   * 현재 가격표에 등록되지 않은 Model은 비용을 추정할 수 없다.
   * 비용 추정 실패 때문에 실제 AI 실행 결과 처리까지 실패하지 않도록
   * 계산 가능한 비용을 0으로 반환한다.
   */
  if (!pricing) {
    return {
      inputCostUsd: 0,
      outputCostUsd: 0,
      totalCostUsd: 0,
    };
  }

  const inputCostUsd =
    (input.usage.inputTokens / 1_000_000) * pricing.inputUsdPerMillionTokens;

  const outputCostUsd =
    (input.usage.outputTokens / 1_000_000) * pricing.outputUsdPerMillionTokens;

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}
