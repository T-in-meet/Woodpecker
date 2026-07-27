import { createAdminClient } from "@/lib/supabase/admin";

import {
  FEEDBACK_REPLY_ALLOWED_TYPES,
  FEEDBACK_REPLY_MAX_IMAGE_COUNT,
  FEEDBACK_REPLY_MAX_IMAGE_SIZE,
} from "../constants/feedback-reply";
import type { FeedbackSignedImage } from "../types/feedback-detail";

/** 답변 이미지 업로드에서 허용하는 실제 이미지 MIME 타입입니다. */
type FeedbackReplyImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

const IMAGE_SIGNATURE_READ_SIZE = 12;

/**
 * 새로 첨부된 답변 이미지 파일의 개수, MIME, 크기 제약을 검증합니다.
 *
 * @param existingCount 유지할 기존 이미지 개수
 * @param files 새로 업로드할 이미지 파일 목록
 * @returns 유효하면 null, 그렇지 않으면 사용자 표시용 오류 문구
 */
export function validateFeedbackReplyImageFiles(
  existingCount: number,
  files: File[],
) {
  if (existingCount + files.length > FEEDBACK_REPLY_MAX_IMAGE_COUNT) {
    return `이미지는 최대 ${FEEDBACK_REPLY_MAX_IMAGE_COUNT}개까지 첨부할 수 있습니다.`;
  }

  for (const file of files) {
    if (
      !(FEEDBACK_REPLY_ALLOWED_TYPES as readonly string[]).includes(file.type)
    ) {
      return "JPG, PNG, GIF, WebP 형식만 업로드할 수 있습니다.";
    }

    if (file.size > FEEDBACK_REPLY_MAX_IMAGE_SIZE) {
      return "이미지 파일은 5MB 이하만 업로드할 수 있습니다.";
    }
  }

  return null;
}

/**
 * 새로 첨부된 답변 이미지의 실제 파일 시그니처를 검증합니다.
 *
 * 브라우저가 선언한 file.type은 변조될 수 있으므로 Storage 업로드 전에
 * magic bytes로 판별한 MIME과 선언 MIME이 일치하는지 서버에서 확인합니다.
 *
 * @param files 새로 업로드할 이미지 파일 목록
 * @returns 유효하면 null, 그렇지 않으면 사용자 표시용 오류 문구
 */
export async function validateFeedbackReplyImageFileSignatures(files: File[]) {
  for (const file of files) {
    const detectedMimeType = await detectFeedbackReplyImageMimeType(file);

    if (detectedMimeType === null || detectedMimeType !== file.type) {
      return "이미지 파일 형식이 올바르지 않습니다.";
    }
  }

  return null;
}

/**
 * feedback_replies bucket의 파일 경로 규칙에 맞는 object path를 생성합니다.
 *
 * @param feedbackId 첫 번째 폴더로 사용할 feedbacks.id
 * @param file 확장자를 결정할 업로드 파일
 * @returns `{feedback_id}/{uuid}.{ext}` 형식의 Storage object path
 */
export function createFeedbackReplyImagePath(feedbackId: string, file: File) {
  const extension = getImageExtension(file);
  const uniqueName =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${feedbackId}/${uniqueName}.${extension}`;
}

/**
 * Storage allowed_mime_types와 일치하는 이미지 확장자를 반환합니다.
 */
function getImageExtension(file: File) {
  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };

  return extensionByMime[file.type] ?? "png";
}

/**
 * 파일 앞부분의 magic bytes로 실제 이미지 MIME을 판별합니다.
 *
 * @param file 검사할 이미지 파일
 * @returns 판별된 MIME 타입. 비어 있거나 헤더가 부족하거나 지원하지 않으면 null
 */
async function detectFeedbackReplyImageMimeType(
  file: File,
): Promise<FeedbackReplyImageMimeType | null> {
  if (file.size === 0) {
    return null;
  }

  const bytes = await readFileHeaderBytes(file);

  if (matchesJpegSignature(bytes)) {
    return "image/jpeg";
  }

  if (matchesPngSignature(bytes)) {
    return "image/png";
  }

  if (matchesGifSignature(bytes)) {
    return "image/gif";
  }

  if (matchesWebpSignature(bytes)) {
    return "image/webp";
  }

  return null;
}

/**
 * 파일 헤더 판별에 필요한 앞부분 bytes만 읽습니다.
 */
async function readFileHeaderBytes(file: File) {
  const headerBlob = file.slice(0, IMAGE_SIGNATURE_READ_SIZE);

  if (typeof FileReader !== "undefined") {
    return readBlobWithFileReader(headerBlob);
  }

  const buffer = await new Response(headerBlob).arrayBuffer();

  return new Uint8Array(buffer);
}

/**
 * jsdom과 브라우저 환경에서 Blob bytes를 읽기 위한 FileReader adapter입니다.
 */
function readBlobWithFileReader(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }

      reject(new Error("Failed to read image header."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read image header."));
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * JPEG SOI marker와 다음 marker prefix를 확인합니다.
 */
function matchesJpegSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

/**
 * PNG 고정 8-byte signature를 확인합니다.
 */
function matchesPngSignature(bytes: Uint8Array) {
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  return hasPrefix(bytes, pngSignature);
}

/**
 * GIF87a 또는 GIF89a signature를 확인합니다.
 */
function matchesGifSignature(bytes: Uint8Array) {
  const gif87aSignature = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
  const gif89aSignature = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];

  return hasPrefix(bytes, gif87aSignature) || hasPrefix(bytes, gif89aSignature);
}

/**
 * WebP RIFF container signature를 확인합니다.
 */
function matchesWebpSignature(bytes: Uint8Array) {
  const riffSignature = [0x52, 0x49, 0x46, 0x46];
  const webpSignature = [0x57, 0x45, 0x42, 0x50];

  return (
    bytes.length >= 12 &&
    hasPrefix(bytes, riffSignature) &&
    hasPrefix(bytes.slice(8), webpSignature)
  );
}

/**
 * Uint8Array가 지정된 byte prefix로 시작하는지 확인합니다.
 */
function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  if (bytes.length < prefix.length) {
    return false;
  }

  return prefix.every((byte, index) => bytes[index] === byte);
}

/** 피드백 이미지가 저장되는 private Storage bucket입니다. */
type FeedbackImageBucket = "feedbacks" | "feedback_replies";

/**
 * private Storage object path 목록을 signed URL 목록으로 변환합니다.
 *
 * @param bucket 이미지가 저장된 private bucket
 * @param paths bucket 내부 object path 목록
 * @returns 원본 object path와 signed URL 목록
 */
export async function createFeedbackSignedImages(
  bucket: FeedbackImageBucket,
  paths: string[],
): Promise<FeedbackSignedImage[]> {
  const supabase = createAdminClient();

  return Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);

      if (error) {
        throw new Error(`Failed to create signed image URL: ${error.message}`);
      }

      return {
        path,
        signedUrl: data.signedUrl,
      };
    }),
  );
}
