import type { LegalSection } from "@/components/legal/LegalContent";
import { LEGAL_CONTACT } from "@/lib/constants/legal";

const DETAIL_GROUP_CLASS_NAME = "my-5 space-y-5";

export const privacySections: LegalSection[] = [
  {
    article: "제1조",
    title: "개인정보의 처리 목적, 항목 및 법적 근거",
    content: (
      <>
        <p>
          딱다구리(이하 &ldquo;서비스&rdquo;)는 아래 목적에 필요한 최소한의
          개인정보를 처리합니다. 회원 서비스 제공에 필요한 정보는 계약의
          체결·이행을 근거로 처리하며, 별도 동의가 필요한 경우에는 해당 화면에서
          동의를 받습니다.
        </p>
        <div className={DETAIL_GROUP_CLASS_NAME}>
          <div>
            <h3 className="text-sm font-semibold">회원 및 인증</h3>
            <p>
              가입, 로그인, 본인 확인과 계정 관리를 위해 이메일, 비밀번호 해시,
              닉네임, 계정 식별자, Google 로그인 제공자 정보·프로필 이미지, 약관
              동의 및 처리방침 확인 기록을 처리합니다. 법적 근거는 개인정보
              보호법 제15조 제1항 제4호에 따른 계약의 체결·이행입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">학습 서비스</h3>
            <p>
              노트, 복습 일정, 퀴즈, 백지 테스트와 노트 대화를 제공하기 위해
              노트 제목·본문, 복습 일정·완료 기록, 답안·점수·AI 피드백, 퀴즈,
              대화 질문·답변, AI 실행·사용량 정보를 처리합니다. 법적 근거는
              개인정보 보호법 제15조 제1항 제4호에 따른 계약 이행입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">알림</h3>
            <p>
              회원이 설정한 복습 및 서비스 알림을 발송하기 위해 알림
              시간·내용·읽음 상태, Web Push endpoint와 p256dh·auth 키를
              처리합니다. 법적 근거는 개인정보 보호법 제15조 제1항 제4호에 따른
              계약 이행입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">피드백</h3>
            <p>
              문의와 제안을 접수하고 답변하기 위해 피드백 제목·본문·분류·첨부
              이미지와 관련 노트 식별자를 처리합니다. 법적 근거는 개인정보
              보호법 제15조 제1항 제4호에 따른 회원 요청 처리입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">보안 및 운영</h3>
            <p>
              부정 이용 방지, 장애 분석과 보안 대응을 위해 접속 기록, IP 주소,
              쿠키, 요청 제한 기록, 사용자 식별자, 오류 코드·메시지·발생
              시각·정제된 실행 정보를 처리합니다. 법적 근거는 개인정보 보호법
              제15조 제1항 제6호에 따른 정당한 이익과 법령상 의무 준수입니다.
            </p>
          </div>
        </div>
        <p>
          회원이 노트·답안·대화·피드백에 입력한 내용에는 개인정보가 포함될 수
          있습니다. 주민등록번호, 건강정보 등 불필요한 민감정보나 제3자의
          개인정보를 입력하지 마세요.
        </p>
      </>
    ),
  },
  {
    article: "제2조",
    title: "개인정보의 수집 방법",
    content: (
      <ul>
        <li>회원가입, 서비스 이용, 피드백 제출 과정에서 회원이 직접 입력</li>
        <li>Google OAuth를 통한 로그인 과정에서 회원이 허용한 정보 수신</li>
        <li>브라우저, 서버, 보안·오류 기록 과정에서 자동 생성·수집</li>
      </ul>
    ),
  },
  {
    article: "제3조",
    title: "개인정보의 처리 및 보유 기간",
    content: (
      <div className={DETAIL_GROUP_CLASS_NAME}>
        <div>
          <h3 className="text-sm font-semibold">서비스 이용 정보</h3>
          <p>
            계정·프로필·학습·피드백·알림 정보는 회원 탈퇴 시까지 보관합니다.
            회원이 직접 삭제할 수 있는 정보는 삭제 요청 또는 삭제 기능 이용
            시까지 보관합니다.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Push 구독 정보</h3>
          <p>
            알림 구독을 해제하거나 Push endpoint가 만료되거나 회원이 탈퇴할
            때까지 보관합니다.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">법적 문서 확인 이력</h3>
          <p>
            약관 동의와 개인정보 처리방침 확인 이력은 회원 탈퇴 시까지
            보관합니다.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">접속·운영 오류 기록</h3>
          <p>
            보안·장애 대응 목적을 달성할 때까지 보관하며, 회원과 연결되는 관련
            식별자는 탈퇴 시 분리하거나 삭제합니다.
          </p>
        </div>
      </div>
    ),
  },
  {
    article: "제4조",
    title: "개인정보의 제3자 제공",
    content: (
      <p>
        서비스는 회원의 개인정보를 처리 목적 범위 내에서만 이용하며, 회원의 별도
        동의 또는 법률의 특별한 규정이 있는 경우를 제외하고 제3자에게 제공하지
        않습니다. Google 로그인 과정에서 서비스는 Google로부터 회원이 허용한
        정보를 전달받습니다.
      </p>
    ),
  },
  {
    article: "제5조",
    title: "개인정보 처리업무의 위탁",
    content: (
      <div className={DETAIL_GROUP_CLASS_NAME}>
        <div>
          <h3 className="text-sm font-semibold">Supabase Inc.</h3>
          <p>인증, 데이터베이스와 파일 저장소 운영 업무를 위탁합니다.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Vercel Inc.</h3>
          <p>웹 애플리케이션 호스팅과 요청 처리 업무를 위탁합니다.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Cloudflare, Inc.</h3>
          <p>AI 퀴즈 생성과 백지 테스트 채점 업무를 위탁합니다.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">OpenAI, L.L.C.</h3>
          <p>노트 대화와 임베딩 생성 업무를 위탁합니다.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Google LLC</h3>
          <p>
            Google 로그인, 설정에 따른 AI 처리와 인증 이메일 전송 업무를
            위탁합니다.
          </p>
        </div>
      </div>
    ),
  },
  {
    article: "제6조",
    title: "개인정보의 국외 이전",
    content: (
      <>
        <p>
          서비스 제공 계약의 이행을 위해 아래 사업자의 서비스 제공 국가로
          개인정보가 전송·보관될 수 있습니다.
        </p>
        <div className={DETAIL_GROUP_CLASS_NAME}>
          <div>
            <h3 className="text-sm font-semibold">Supabase Inc.</h3>
            <p>
              계정 및 서비스 데이터의 인증·저장·지원을 위해 서비스 이용 중
              암호화된 네트워크로 수시 전송합니다. 데이터는 대한민국
              (ap-northeast-2)에 저장되며 싱가포르·미국 등에서 지원 목적으로
              처리될 수 있습니다. 회원 탈퇴 또는 위탁계약 종료 시까지 보유하며,
              문의처는 privacy@supabase.io입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Vercel Inc.</h3>
            <p>
              요청·접속 정보와 화면 응답의 애플리케이션 처리를 위해 서비스 요청
              시 미국 및 하위 처리자 운영 국가로 암호화 전송합니다. 요청 처리 및
              계약·로그 설정에 따른 기간 동안 보유하며, 문의처는
              privacy@vercel.com입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Cloudflare, Inc.</h3>
            <p>
              노트·답안의 AI 퀴즈 생성·채점을 위해 AI 기능 이용 시 미국,
              유럽경제지역 등 글로벌 네트워크로 암호화 전송합니다. Workers AI
              추론 처리 기간에 처리되며, 별도 저장 서비스를 사용하지 않는 한
              고객 콘텐츠를 저장하지 않습니다. 문의처는
              privacyquestions@cloudflare.com입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">OpenAI, L.L.C.</h3>
            <p>
              노트·질문의 대화·임베딩 처리를 위해 AI 기능 이용 시 미국 등 OpenAI
              및 하위 처리자 운영 국가로 암호화 전송합니다. API 오남용
              모니터링을 위해 최대 30일 동안 보유하며, 법령상 보존이 필요한
              경우는 예외입니다. 문의처는 dpo@openai.com입니다.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Google LLC</h3>
            <p>
              Google 로그인 정보, 설정에 따른 Gemini 입력·출력과 인증 이메일을
              처리하기 위해 로그인·AI·이메일 기능 이용 시 미국 등 Google 및 하위
              처리자 운영 국가로 암호화 전송합니다. 정보는 로그인 연동 기간,
              Gemini 프로젝트 설정에 따른 처리·로그 기간(설정형 로그 최대 55일),
              또는 인증 메일을 발송 계정에서 삭제할 때까지 보유합니다. 문의는{" "}
              <a
                href="https://support.google.com/policies/troubleshooter/7575787"
                className="underline"
                target="_blank"
                rel="noreferrer"
              >
                Google 개인정보 문의
              </a>
              를 이용할 수 있습니다.
            </p>
          </div>
        </div>
        <p>
          국외 이전을 원하지 않으면 해당 외부 기능을 이용하지 않거나 회원 탈퇴를
          요청할 수 있습니다. 다만 인증·저장 등 필수 이전을 거부하면 서비스
          이용이 어렵습니다.
        </p>
      </>
    ),
  },
  {
    article: "제7조",
    title: "정보주체와 법정대리인의 권리 및 행사 방법",
    content: (
      <>
        <p>
          회원은 개인정보의 열람, 전송, 정정·삭제, 처리정지, 동의 철회를 요구할
          수 있습니다. 마이페이지의 계정·알림·탈퇴 기능 또는 개인정보 담당
          이메일로 요청할 수 있으며, 대리인을 통한 요청에는 위임 확인을 요구할
          수 있습니다.
        </p>
        <p className="mt-2">
          법령상 의무 준수, 다른 사람의 권리 보호 또는 계약 이행을 위해 필요한
          경우에는 요청이 제한될 수 있으며 그 사유를 안내합니다.
        </p>
      </>
    ),
  },
  {
    article: "제8조",
    title: "개인정보의 파기",
    content: (
      <ol>
        <li>보유기간 경과 또는 처리 목적 달성 시 지체 없이 파기합니다.</li>
        <li>
          전자 파일은 복구하기 어려운 방법으로 삭제하고 출력물은 파쇄합니다.
        </li>
        <li>
          법령에 따라 보존할 정보가 있으면 다른 정보와 분리하여 보관합니다.
        </li>
        <li>
          백업에 남은 정보는 백업 정책에 따른 주기가 끝날 때 영구 삭제됩니다.
        </li>
      </ol>
    ),
  },
  {
    article: "제9조",
    title: "쿠키와 자동 수집 정보",
    content: (
      <p>
        서비스는 로그인 세션 유지와 보안을 위해 필수 쿠키를 사용합니다. 브라우저
        설정에서 쿠키를 삭제하거나 저장을 거부할 수 있지만 로그인 기능이 제한될
        수 있습니다. 광고 추적 목적의 쿠키는 사용하지 않습니다.
      </p>
    ),
  },
  {
    article: "제10조",
    title: "개인정보의 안전성 확보 조치",
    content: (
      <ul>
        <li>업무상 필요한 최소 인원으로 접근 권한 제한 및 관리자 권한 검증</li>
        <li>전송구간 암호화, 비밀번호 해시 처리 및 서버 비밀정보 분리</li>
        <li>사용자별 데이터 접근을 제한하는 Row Level Security 적용</li>
        <li>접속·오류 기록 관리와 민감정보 마스킹, 보안 업데이트</li>
      </ul>
    ),
  },
  {
    article: "제11조",
    title: "만 14세 미만 아동의 개인정보",
    content: (
      <p>
        서비스는 만 14세 미만 아동의 회원가입을 허용하지 않습니다. 회원가입 시
        만 14세 이상임을 확인하며, 만 14세 미만 가입 사실을 알게 되면 계정과
        개인정보를 지체 없이 삭제합니다.
      </p>
    ),
  },
  {
    article: "제12조",
    title: "개인정보 보호 담당 부서",
    content: (
      <ul>
        <li>담당 부서: {LEGAL_CONTACT.department}</li>
        <li>이메일: {LEGAL_CONTACT.email}</li>
      </ul>
    ),
  },
  {
    article: "제13조",
    title: "권익침해 구제 방법",
    content: (
      <ul>
        <li>개인정보침해 신고센터: 국번 없이 118</li>
        <li>개인정보분쟁조정위원회: 1833-6972</li>
        <li>대검찰청: 국번 없이 1301</li>
        <li>경찰청: 국번 없이 182</li>
      </ul>
    ),
  },
  {
    article: "제14조",
    title: "개인정보 처리방침의 변경",
    content: (
      <p>
        이 처리방침은 2026년 8월 21일 공개되었으며 2026년 9월 20일부터
        시행합니다. 중요한 변경은 시행 30일 전, 그 밖의 변경은 시행 7일 전부터
        서비스 화면 등을 통해 알립니다. 이전 처리방침은 요청 시 확인할 수
        있습니다.
      </p>
    ),
  },
];
