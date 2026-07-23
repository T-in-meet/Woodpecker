import type { MockUser } from "../types/mock-user";

const USER_STATUS_LABELS = {
  active: "활성",
  inactive: "비활성",
  suspended: "정지",
} as const;

const USER_ROLE_LABELS = {
  user: "사용자",
  editor: "편집자",
  manager: "매니저",
  admin: "관리자",
} as const;

const USER_GRADE_LABELS = {
  basic: "일반",
  premium: "프리미엄",
  vip: "VIP",
} as const;

interface MockUserTableProps {
  /** 현재 페이지에 표시할 Mock 사용자 목록 */
  users: MockUser[];

  /** 최초 사용자 목록 조회 여부 */
  isPending: boolean;

  /** 사용자 목록 조회 실패 여부 */
  isError: boolean;
}

/**
 * Component Playground에서 조회한 Mock 사용자 목록을 표시합니다.
 *
 * 목록의 로딩, 오류, 빈 결과 상태를 테이블 내부에서 함께 처리합니다.
 */
export function MockUserTable({
  users,
  isPending,
  isError,
}: MockUserTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium">ID</th>
            <th className="px-4 py-3 text-left font-medium">이름</th>
            <th className="px-4 py-3 text-left font-medium">이메일</th>
            <th className="px-4 py-3 text-left font-medium">상태</th>
            <th className="px-4 py-3 text-left font-medium">역할</th>
            <th className="px-4 py-3 text-left font-medium">등급</th>
            <th className="px-4 py-3 text-left font-medium">점수</th>
            <th className="px-4 py-3 text-left font-medium">가입일</th>
          </tr>
        </thead>

        <tbody>
          {isPending ? (
            <MockUserTableMessage>
              사용자 목록을 불러오는 중입니다.
            </MockUserTableMessage>
          ) : isError ? (
            <MockUserTableMessage className="text-destructive">
              사용자 목록을 불러오지 못했습니다.
            </MockUserTableMessage>
          ) : users.length > 0 ? (
            users.map((user) => (
              <tr key={user.id} className="border-b last:border-b-0">
                <td className="px-4 py-3">{user.id}</td>
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>

                <td className="px-4 py-3">{USER_STATUS_LABELS[user.status]}</td>

                <td className="px-4 py-3">
                  {user.roles.map((role) => USER_ROLE_LABELS[role]).join(", ")}
                </td>

                <td className="px-4 py-3">{USER_GRADE_LABELS[user.grade]}</td>

                <td className="px-4 py-3">{user.score}</td>

                <td className="px-4 py-3">
                  {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))
          ) : (
            <MockUserTableMessage>
              검색 조건과 일치하는 사용자가 없습니다.
            </MockUserTableMessage>
          )}
        </tbody>
      </table>
    </div>
  );
}

interface MockUserTableMessageProps {
  /** 테이블 상태 안내 문구 */
  children: React.ReactNode;

  /** 상태별 추가 스타일 */
  className?: string;
}

/**
 * Mock 사용자 테이블의 로딩, 오류, 빈 결과 안내 행입니다.
 */
function MockUserTableMessage({
  children,
  className,
}: MockUserTableMessageProps) {
  return (
    <tr>
      <td
        colSpan={8}
        className={`px-4 py-10 text-center text-muted-foreground ${className ?? ""}`}
      >
        {children}
      </td>
    </tr>
  );
}
