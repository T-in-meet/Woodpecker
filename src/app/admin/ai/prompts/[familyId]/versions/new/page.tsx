import { notFound } from "next/navigation";

import { AdminAiPromptVersionCreateClient } from "@/features/admin/ai/prompts/components/AdminAiPromptVersionCreateClient";
import { getAdminAiPromptFamilyDetail } from "@/features/admin/ai/prompts/queries";

type AdminAiPromptVersionNewPageProps = {
  /** 동적 route parameter입니다. */
  params: Promise<{
    familyId: string;
  }>;

  /** 생성 폼 복사 원본을 지정하는 query parameter입니다. */
  searchParams: Promise<{
    sourceVersionId?: string | string[];
  }>;
};

/**
 * query parameter에서 단일 Prompt Version ID 값을 읽습니다.
 *
 * @param value sourceVersionId query parameter 값
 * @returns 단일 문자열 ID 또는 값이 없으면 undefined
 */
function readSourceVersionId(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

/**
 * AI prompt version 생성 페이지를 렌더링합니다.
 *
 * @param props route props
 * @returns prompt version 생성 폼
 */
export default async function AdminAiPromptVersionNewPage({
  params,
  searchParams,
}: AdminAiPromptVersionNewPageProps) {
  const [{ familyId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const family = await getAdminAiPromptFamilyDetail(familyId);

  if (!family) {
    notFound();
  }

  const sourceVersionId = readSourceVersionId(
    resolvedSearchParams.sourceVersionId,
  );
  const sourceVersion =
    sourceVersionId !== undefined
      ? family.versions.find((version) => version.id === sourceVersionId)
      : undefined;

  if (sourceVersionId !== undefined && sourceVersion === undefined) {
    notFound();
  }

  return (
    <AdminAiPromptVersionCreateClient
      family={family}
      {...(sourceVersion !== undefined ? { sourceVersion } : {})}
    />
  );
}
