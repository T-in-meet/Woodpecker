import type { Metadata } from "next";

import { SITE_NAME } from "@/lib/constants/site";

/* openGraph·twitter는 부모 메타데이터와 깊은 병합이 되지 않는다. 자식이 openGraph를
   선언하면 부모 것을 통째로 대체하므로, 페이지 하나의 og:title을 바꾸려 해도
   type·locale·siteName·images까지 전부 다시 적어야 한다. 반대로 선언하지 않으면
   루트의 값(= 홈 문구)을 그대로 물려받는다.

   그 공통 필드를 여기 모아 두고 페이지는 자기 title·description·url만 넘긴다. */
const OG_IMAGE = {
  // metadataBase가 있어 상대 경로가 절대 URL로 변환된다.
  // 파일은 scripts/generate-og-image.mjs로 굽는다.
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "딱다구리 — 기록이 기억이 되는 공간",
} as const;

type SocialMetadataInput = {
  title: string;
  description: string;
  url: string;
};

export function buildSocialMetadata({
  title,
  description,
  url,
}: SocialMetadataInput): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url,
      siteName: SITE_NAME,
      title,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      // openGraph.images와 달리 URL 문자열만 넘기면 twitter:image:alt이 빠진다.
      // 이미지가 안 뜨거나 스크린 리더로 읽을 때 남는 설명이라 함께 넘긴다.
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}
