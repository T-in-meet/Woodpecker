import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, type LegalSection } from "@/app/(legal)/LegalPage";

export const metadata: Metadata = {
  title: "이용약관 | 딱다구리",
  description: "딱다구리 서비스 이용약관",
};

const EFFECTIVE_DATE = "2026년 3월 24일";

const sections: LegalSection[] = [
  {
    article: "제1조",
    title: "목적",
    content: (
      <p>
        이 약관은 딱다구리(이하 &ldquo;서비스&rdquo;)가 제공하는 간격반복 학습
        노트 서비스의 이용 조건 및 절차, 회원과 서비스 간의 권리·의무 및
        책임사항을 규정함을 목적으로 합니다.
      </p>
    ),
  },
  {
    article: "제2조",
    title: "정의",
    content: (
      <>
        <p>이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
        <ol>
          <li>
            &ldquo;서비스&rdquo;란 딱다구리가 제공하는 간격반복 학습 노트 및
            복습 알림 서비스 일체를 의미합니다.
          </li>
          <li>
            &ldquo;회원&rdquo;이란 서비스에 접속하여 이 약관에 동의하고 아이디를
            부여받은 자를 의미합니다.
          </li>
          <li>
            &ldquo;노트(기록)&rdquo;란 회원이 서비스에 입력한 학습 내용(최대
            1,000자)을 의미합니다.
          </li>
          <li>
            &ldquo;복습 알림&rdquo;이란 간격반복 스케줄(1일·3일·7일)에 따라
            발송되는 푸시 알림을 의미합니다.
          </li>
        </ol>
      </>
    ),
  },
  {
    article: "제3조",
    title: "약관의 효력 및 변경",
    content: (
      <ol>
        <li>
          이 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이
          발생합니다.
        </li>
        <li>
          서비스는 합리적인 사유가 있는 경우 약관을 변경할 수 있으며, 변경 시
          최소 7일 전 공지합니다.
        </li>
        <li>
          회원이 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할
          수 있습니다.
        </li>
      </ol>
    ),
  },
  {
    article: "제4조",
    title: "회원가입 및 계정 관리",
    content: (
      <ol>
        <li>회원가입은 이메일 주소 및 비밀번호를 입력하여 신청합니다.</li>
        <li>
          다음 각 호에 해당하는 경우 가입을 거부할 수 있습니다.
          <ul>
            <li>타인의 정보를 도용하여 신청한 경우</li>
            <li>이전에 약관 위반으로 자격을 상실한 경우</li>
            <li>기타 서비스 운영에 지장을 초래할 우려가 있는 경우</li>
          </ul>
        </li>
        <li>
          회원은 계정 정보를 본인이 관리해야 하며, 타인에게 양도하거나 대여할 수
          없습니다.
        </li>
      </ol>
    ),
  },
  {
    article: "제5조",
    title: "서비스의 제공",
    content: (
      <ol>
        <li>
          서비스는 다음을 제공합니다.
          <ul>
            <li>학습 노트 작성 및 관리 기능</li>
            <li>간격반복(1일·3일·7일) 복습 스케줄 자동 생성</li>
            <li>복습 알림 푸시 발송 기능</li>
            <li>빈칸 테스트 등 학습 지원 기능</li>
          </ul>
        </li>
        <li>
          서비스는 점검, 장애, 천재지변 등의 이유로 일시 중단될 수 있습니다.
        </li>
      </ol>
    ),
  },
  {
    article: "제6조",
    title: "회원의 의무",
    content: (
      <>
        <p>회원은 다음 행위를 해서는 안 됩니다.</p>
        <ul>
          <li>타인의 정보 도용 또는 허위 정보 등록</li>
          <li>서비스의 정상적인 운영을 방해하는 행위</li>
          <li>서비스를 통해 얻은 정보를 무단으로 복제·배포하는 행위</li>
          <li>기타 관련 법령에 위반되는 행위</li>
        </ul>
      </>
    ),
  },
  {
    article: "제7조",
    title: "서비스 이용 제한",
    content: (
      <p>
        서비스는 회원이 제6조를 위반한 경우 이용을 제한하거나 계정을 정지·삭제할
        수 있습니다.
      </p>
    ),
  },
  {
    article: "제8조",
    title: "개인정보 보호",
    content: (
      <p>
        서비스는 개인정보 처리방침에 따라 회원의 개인정보를 보호합니다. 개인정보
        처리방침은 서비스 내{" "}
        <Link
          href="/privacy"
          className="text-amber-700 underline underline-offset-2 transition-colors hover:text-amber-900"
        >
          /privacy
        </Link>{" "}
        페이지에서 확인할 수 있습니다.
      </p>
    ),
  },
  {
    article: "제9조",
    title: "푸시 알림",
    content: (
      <ol>
        <li>
          복습 알림은 회원의 명시적 동의(Web Push 구독)를 통해서만 발송됩니다.
        </li>
        <li>회원은 알림 설정 화면에서 언제든지 수신을 거부할 수 있습니다.</li>
        <li>
          알림 발송은 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」
          제50조를 준수합니다.
        </li>
      </ol>
    ),
  },
  {
    article: "제10조",
    title: "면책조항",
    content: (
      <ol>
        <li>
          서비스는 천재지변, 불가항력적 사유로 인한 서비스 중단에 대해 책임지지
          않습니다.
        </li>
        <li>
          회원이 직접 입력한 학습 노트의 내용에 대한 책임은 회원 본인에게
          있습니다.
        </li>
        <li>
          MVP 단계의 서비스는 안정성을 완전히 보장하지 않을 수 있으며, 이를
          회원은 인지하고 동의합니다.
        </li>
      </ol>
    ),
  },
  {
    article: "제11조",
    title: "분쟁 해결",
    content: (
      <p>
        이 약관에 관한 분쟁은 대한민국 법률에 따라 처리하며, 관할 법원은
        민사소송법에 따른 법원으로 합니다.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="이용약관"
      effectiveDate={EFFECTIVE_DATE}
      intro="딱다구리 서비스를 이용하시면 아래 이용약관에 동의한 것으로 간주됩니다. 회원가입 전 아래 내용을 꼼꼼히 읽어주세요."
      sections={sections}
      crossLink={{ href: "/privacy", label: "개인정보 처리방침" }}
      footerNote={`부칙: 이 약관은 ${EFFECTIVE_DATE}부터 시행합니다.`}
    />
  );
}
