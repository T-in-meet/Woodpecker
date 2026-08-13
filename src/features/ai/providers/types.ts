import type { Json } from "@/types/db.helpers";

import type { AiModelProvider } from "../constants/models";
import { AI_PROVIDER_CHAT_MESSAGE_ROLE } from "./constants";

/**
 * Provider Chat Completion 요청에서 사용할 응답 형식입니다.
 *
 * `json_object`는 JSON 객체 응답을 요청하고,
 * `json_schema`는 지정한 JSON Schema에 맞는 응답을 요청합니다.
 */
export type AiChatResponseFormat =
  | {
      /** Provider에 JSON 객체 응답을 요청합니다. */
      type: "json_object";
    }
  | {
      /** Provider에 전달할 JSON Schema 설정입니다. */
      jsonSchema: {
        /** Provider가 식별할 JSON Schema 이름입니다. */
        name: string;

        /** Provider에 전달할 JSON Schema 정의입니다. */
        schema: Json;

        /** Provider가 JSON Schema 준수를 강제할지 여부입니다. */
        strict: boolean;
      };

      /** Provider에 지정된 JSON Schema 응답을 요청합니다. */
      type: "json_schema";
    };

/**
 * Provider별 응답 차이를 정규화한 token usage입니다.
 *
 * Provider 구현은 원본 usage 필드를 이 공통 형식으로 변환해야 합니다.
 */
export type AiTokenUsage = {
  /** 입력에 사용된 token 수입니다. */
  inputTokens: number;

  /** 출력에 사용된 token 수입니다. */
  outputTokens: number;

  /** 입력과 출력 token을 합산한 총 token 수입니다. */
  totalTokens: number;
};

/**
 * Provider embedding 생성 결과입니다.
 *
 * Provider별 embedding 응답을 공통 결과 형태로 정규화합니다.
 */
export type AiEmbeddingResult = {
  /** 생성된 embedding vector입니다. */
  embedding: number[];

  /** Provider가 반환한 부가 메타데이터입니다. */
  metadata: Json;

  /** 정규화된 token usage입니다. */
  usage: AiTokenUsage;
};

/**
 * Provider Chat Completion 생성 결과입니다.
 *
 * Provider별 Chat Completion 응답을 공통 결과 형태로 정규화합니다.
 */
export type AiChatCompletionResult = {
  /** Provider가 생성한 최종 응답 내용입니다. */
  content: string;

  /** Provider가 반환한 부가 메타데이터입니다. */
  metadata: Json;

  /** 정규화된 token usage입니다. */
  usage: AiTokenUsage;
};

/**
 * Provider 호출에 공통으로 필요한 식별자와 인증 정보입니다.
 */
export type AiProviderCallParams = {
  /** 호출할 AI Provider입니다. */
  provider: AiModelProvider;

  /** Provider API 인증에 사용할 API key입니다. */
  apiKey: string;

  /** Provider에 전달할 실제 Model 식별자입니다. */
  model: string;
};

/**
 * AI Provider Chat 메시지 역할 타입입니다.
 */
export type AiProviderChatMessageRole =
  (typeof AI_PROVIDER_CHAT_MESSAGE_ROLE)[keyof typeof AI_PROVIDER_CHAT_MESSAGE_ROLE];

/**
 * AI Provider에 전달하는 공통 Chat 메시지입니다.
 *
 * Provider별 메시지 형식으로 변환하기 전의 공통 표현입니다.
 */
export type AiProviderChatMessage = {
  /** 메시지의 대화 역할입니다. */
  role: AiProviderChatMessageRole;

  /** 메시지 본문입니다. */
  content: string;
};

/**
 * AI Provider Chat 스트림에서 전달하는 이벤트입니다.
 *
 * `text-delta`는 생성 중인 텍스트 일부를 전달하고,
 * `finish`는 스트림이 정상적으로 완료되었음을 나타냅니다.
 */
export type AiChatStreamEvent =
  | {
      /** 생성 중인 텍스트 일부를 나타내는 이벤트입니다. */
      type: "text-delta";

      /** 새롭게 생성된 텍스트 조각입니다. */
      delta: string;
    }
  | {
      /** Provider 스트림의 정상적인 완료를 나타내는 이벤트입니다. */
      type: "finish";

      /** 스트림 완료 시점의 정규화된 결과입니다. */
      result: AiChatStreamResult;
    };

/**
 * AI Provider 스트림이 정상적으로 완료된 결과입니다.
 *
 * 스트림의 최종 텍스트와 Provider 메타데이터 및 token usage를 포함합니다.
 */
export type AiChatStreamResult = {
  /** 스트림을 통해 생성된 최종 응답 내용입니다. */
  content: string;

  /** Provider가 반환한 부가 메타데이터입니다. */
  metadata: Json;

  /** 정규화된 token usage입니다. */
  usage: AiTokenUsage;
};

/**
 * AI Provider Chat 스트리밍 요청에 공통으로 필요한 값입니다.
 */
export type AiChatStreamParams = AiProviderCallParams & {
  /** Provider에 전달할 Chat 메시지 목록입니다. */
  messages: AiProviderChatMessage[];

  /**
   * Provider에 요청할 응답 형식입니다.
   *
   * 지정하지 않으면 Provider 기본 응답 형식을 사용합니다.
   */
  responseFormat?: AiChatResponseFormat | undefined;

  /** Provider Chat 요청에 사용할 temperature입니다. */
  temperature: number;
};
