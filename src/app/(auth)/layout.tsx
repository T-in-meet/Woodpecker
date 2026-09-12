import { DocumentScrollLock } from "@/components/layout/DocumentScrollLock";
import { Header } from "@/components/layout/Header";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Header와 Auth 콘텐츠가 viewport 전체 높이를 기준으로 배치되도록
  // 세로 flex 컨테이너를 구성한다.
  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <DocumentScrollLock />

      {/*
        Auth 페이지의 공통 배치를 이 layout에서 담당한다.
        - 모바일: 상단부터 자연스럽게 콘텐츠가 이어진다.
        - auth 이상: Header를 제외한 남은 영역에서 세로 중앙 정렬한다.
        - 가로 중앙 정렬과 외부 여백도 개별 페이지가 아닌 layout이 담당한다.
        - Header는 스크롤 영역 밖에 두고, Auth 콘텐츠 영역만 필요할 때 스크롤한다.
      */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col items-center pb-16 auth:justify-center auth:px-4 auth:py-4">
          {children}
        </div>
      </main>
    </div>
  );
}
