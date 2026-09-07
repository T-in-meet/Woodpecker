// sitemap: 검색엔진에 노출시키고 싶은 페이지 목록

import type { MetadataRoute } from "next";

import { LEGAL_NOTICE_DATE } from "@/lib/constants/legal";
import { ROUTES } from "@/lib/constants/routes";
import { SITE_URL } from "@/lib/constants/site";

/* lastModified는 "콘텐츠가 마지막으로 의미 있게 바뀐 시각"이어야 한다.
   빌드 시각(new Date())을 넣으면 내용이 그대로여도 배포할 때마다 갱신되는데,
   구글은 부정확한 lastmod를 학습하면 그 사이트의 lastmod를 통째로 무시한다.

   - 약관·개인정보 처리방침: 개정본이 공개된 날(LEGAL_NOTICE_DATE)이 실제 수정일이다.
     시행일(LEGAL_EFFECTIVE_DATE)은 미래일 수 있어 lastmod로 쓸 수 없다.
   - 랜딩(/): 정직하게 채울 수 있는 값이 없어 lastmod를 생략한다. lastmod는 선택
     항목이고, 없으면 구글이 자체 크롤 이력으로 판단한다. 거짓 날짜보다 낫다.
     랜딩 콘텐츠 개정일을 따로 관리하게 되면 그 상수를 여기 연결한다. */
const legalLastModified = new Date(`${LEGAL_NOTICE_DATE}T00:00:00+09:00`);

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}${ROUTES.TERMS}`,
      lastModified: legalLastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}${ROUTES.PRIVACY}`,
      lastModified: legalLastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
