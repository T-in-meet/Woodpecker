import { z } from "zod";

/**
 * 구조화 출력 스키마에 실어 보낼 키워드 목록.
 * 통과가 보장된 것만 남기고 나머지는 버린다. 모르는 키를 그대로 보내면
 * 무시되는지 거부되는지 알 수 없기 때문이다.
 */
const SUPPORTED_KEYWORDS = new Set([
  "$id",
  "$defs",
  "$ref",
  "$anchor",
  "type",
  "format",
  "title",
  "description",
  "enum",
  "items",
  "prefixItems",
  "minItems",
  "maxItems",
  "minimum",
  "maximum",
  "anyOf",
  "oneOf",
  "properties",
  "additionalProperties",
  "required",
]);

/** 키가 스키마가 아니라 "이름 → 스키마" 맵인 자리. 여기의 키 이름은 걸러내면 안 된다. */
const SCHEMA_MAP_KEYWORDS = new Set(["properties", "$defs"]);

function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(sanitize);
  }

  if (node === null || typeof node !== "object") {
    return node;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(node)) {
    // const 지원 여부는 프로바이더·모델마다 갈린다. 퀴즈 유형 고정이 이 스키마의
    // 핵심이라, 어디서나 통하는 enum으로 바꿔 형식 이탈 여지를 없앤다.
    if (key === "const") {
      result.enum = [value];
      continue;
    }

    if (!SUPPORTED_KEYWORDS.has(key)) {
      continue;
    }

    if (
      SCHEMA_MAP_KEYWORDS.has(key) &&
      value !== null &&
      typeof value === "object"
    ) {
      result[key] = Object.fromEntries(
        Object.entries(value).map(([name, schema]) => [name, sanitize(schema)]),
      );
      continue;
    }

    result[key] = sanitize(value);
  }

  return result;
}

/**
 * Zod 스키마를 Cloudflare Workers AI의 `response_format.json_schema` 값으로 바꾼다.
 *
 * 응답 구조를 디코딩 단계에서 강제해 형식 이탈 자체를 줄이는 용도다.
 * 검증은 그대로 Zod가 맡는다. 이 스키마는 첫 번째 방어선일 뿐이다.
 * Cloudflare도 스키마 준수를 보장하지는 않는다고 문서에 명시한다.
 */
export function toCloudflareResponseSchema(schema: z.ZodType): unknown {
  return sanitize(z.toJSONSchema(schema, { io: "output" }));
}
