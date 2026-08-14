type AdminActionMessageProps = {
  message: string | null;
};

/**
 * Mutation 결과 메시지를 화면에 표시합니다.
 *
 * @param props 메시지 값
 * @returns 메시지 요소 또는 null
 */
export function AdminActionMessage({ message }: AdminActionMessageProps) {
  if (!message) {
    return null;
  }

  return <p className="text-sm text-destructive">{message}</p>;
}
