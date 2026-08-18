import { NextResponse } from "next/server";

import { requireAdmin } from "@/features/admin/utils/require-admin";
import { generateNoteEmbedding } from "@/features/ai/rags/note/generate-embedding";
import { resolveAiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 한 번의 backfill 요청에서 처리할 최대 Note 수입니다.
 *
 * 모든 Note를 하나의 서버 요청에서 처리할 경우 Note 수와 chunk 수에 따라
 * 서버리스 요청 제한 시간을 초과할 수 있으므로 작은 batch 단위로 나눠 처리합니다.
 *
 * Provider 요청은 각 batch 내부에서도 순차적으로 실행합니다.
 */
const NOTE_EMBEDDING_BACKFILL_BATCH_SIZE = 10;

/**
 * 기존 Note의 RAG embedding을 현재 chunk + generation 구조로 다시 생성합니다.
 *
 * 기존 환경의 Note를 새 embedding 구조로 전환하기 위한 일회성 관리자 API입니다.
 * 관리자 인증을 통과한 요청에서만 실행하며, 실제 Note 생성/수정 경로와 동일한
 * generateNoteEmbedding()을 사용해 청킹, generation 생성/활성화 및 cleanup 정책을
 * 그대로 적용합니다.
 *
 * 모든 Note를 하나의 요청에서 처리하지 않고 offset 기반 batch로 나누어 처리합니다.
 * 응답의 nextOffset을 다음 요청의 offset으로 전달하여 후속 batch를 실행할 수 있습니다.
 *
 * Note 자체는 수정하지 않으므로 title/content/updated_at에는 영향을 주지 않습니다.
 */
export async function POST(request: Request) {
  /**
   * service role client를 생성하기 전에 현재 요청 사용자가 관리자인지 확인합니다.
   *
   * 이 Route는 모든 사용자의 Note를 조회하고 embedding을 다시 생성하므로
   * 관리자 인증을 유일한 외부 실행 진입점으로 사용합니다.
   */
  await requireAdmin();

  /**
   * backfill 진행 위치를 query parameter로 전달받습니다.
   *
   * 첫 요청에서는 offset을 생략할 수 있으며 0부터 시작합니다.
   * 음수나 정수가 아닌 값은 잘못된 관리자 요청으로 간주합니다.
   */
  const { searchParams } = new URL(request.url);
  const offsetParam = searchParams.get("offset");
  const offset = offsetParam === null ? 0 : Number(offsetParam);

  if (!Number.isInteger(offset) || offset < 0) {
    return NextResponse.json(
      {
        error: "Backfill offset must be a non-negative integer.",
      },
      {
        status: 400,
      },
    );
  }

  const supabase = createAdminClient();

  /**
   * 실제 Note 생성/수정과 동일한 Note Retrieval Runtime 설정을 사용합니다.
   * Provider나 Model을 backfill 전용 코드에 별도로 하드코딩하지 않습니다.
   *
   * Runtime 설정을 찾지 못하면 Note를 처리하기 전에 예외가 발생하므로
   * 잘못된 Model/Setting으로 일부 Note만 생성되는 상태를 만들지 않습니다.
   */
  const embeddingConfiguration = await resolveAiRuntimeEmbeddingConfiguration({
    featureKey: NOTE_CHAT_AI_FEATURE_KEY,
    roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
  });

  /**
   * 실제 처리할 batch보다 한 건을 더 조회합니다.
   *
   * 추가 한 건의 존재 여부를 이용해 후속 batch가 남아 있는지 판단하므로,
   * 전체 Note count를 별도로 조회하지 않아도 hasMore를 계산할 수 있습니다.
   *
   * created_at이 동일한 Note 사이에서도 순서를 안정적으로 유지하기 위해
   * id를 두 번째 정렬 기준으로 사용합니다.
   */
  const { data: notes, error } = await supabase
    .from("notes")
    .select("id, user_id, title, content, updated_at")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + NOTE_EMBEDDING_BACKFILL_BATCH_SIZE);

  if (error) {
    return NextResponse.json(
      {
        error: `Failed to load notes: ${error.message}`,
      },
      {
        status: 500,
      },
    );
  }

  const loadedNotes = notes ?? [];
  const hasMore = loadedNotes.length > NOTE_EMBEDDING_BACKFILL_BATCH_SIZE;

  /**
   * hasMore 판별을 위해 조회한 마지막 한 건은 이번 요청에서 처리하지 않습니다.
   * 실제 embedding 생성 대상은 설정된 batch size까지만 제한합니다.
   */
  const batchNotes = loadedNotes.slice(0, NOTE_EMBEDDING_BACKFILL_BATCH_SIZE);

  const failures: Array<{
    error: string;
    noteId: string;
  }> = [];

  let succeeded = 0;

  /**
   * Provider rate limit을 불필요하게 자극하지 않고,
   * 한 Note의 generation 작업이 끝난 뒤 다음 Note를 처리하도록
   * 현재 batch의 Note를 순차적으로 재임베딩합니다.
   *
   * 한 Note가 실패하더라도 나머지 Note의 backfill은 계속 진행합니다.
   * generateNoteEmbedding() 내부에서 일반적인 실패가 발생하면 실패한 새
   * generation을 정리하고 기존 활성 generation은 그대로 유지합니다.
   *
   * 서버 프로세스가 timeout 등으로 강제 종료되는 경우 catch가 실행되지 않을 수
   * 있으므로, 한 요청에서 처리하는 Note 수 자체를 제한해 그 위험 범위를 줄입니다.
   */
  for (const note of batchNotes) {
    try {
      await generateNoteEmbedding({
        content: note.content,
        embeddingConfiguration,
        noteId: note.id,
        ownerUserId: note.user_id,
        sourceUpdatedAt: note.updated_at,
        title: note.title,
      });

      succeeded += 1;
    } catch (error) {
      failures.push({
        error:
          error instanceof Error
            ? error.message
            : "Unknown embedding backfill error",
        noteId: note.id,
      });
    }
  }

  /**
   * 실패한 Note도 이번 batch에서는 처리한 것으로 간주해 다음 offset으로 이동합니다.
   *
   * failures에 실패한 Note ID를 반환하므로 필요한 경우 해당 Note만 별도로
   * 확인하거나 전체 backfill 완료 후 다시 실행할 수 있습니다.
   */
  const nextOffset = hasMore ? offset + batchNotes.length : null;

  return NextResponse.json({
    failed: failures.length,
    failures,
    hasMore,
    nextOffset,
    offset,
    processed: batchNotes.length,
    succeeded,
  });
}
