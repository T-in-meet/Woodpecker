/**
 * 이메일 인증 안내 페이지 (Server Component)
 *
 * 설계 의도:
 * - auth-rules.md 정책에 따라 회원가입 완료 후 단일 진입점 역할을 한다.
 * - 서버에서 searchParams를 비동기로 파싱해 클라이언트 컴포넌트에 전달한다.
 *   → Next.js App Router에서 searchParams는 Promise이므로 await가 필요하다.
 * - 실제 인터랙션(재발송 버튼, 쿨다운)은 VerifyEmailPageClient에 위임한다.
 *
 * email searchParam:
 * - 회원가입 성공 시 redirectTo: '/verify-email?email=...' 형태로 전달된다.
 * - 없으면 undefined로 전달되며, 클라이언트에서 빈 input으로 처리한다.
 */

import type { Metadata } from "next";

import VerifyEmailPageClient from "@/features/auth/verify-email/components/VerifyEmailPageClient";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 - 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return <VerifyEmailPageClient email={email} />;
}
