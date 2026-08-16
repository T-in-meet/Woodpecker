import { useEffect, useRef } from "react";

/** 스크롤 대상 판별에 필요한 최소한의 필드 형태입니다. */
type ScrollableField = {
  /** React Hook Form의 기본 필드 배열 항목 ID입니다. */
  id?: string;

  /** `keyName`으로 분리한 React Hook Form 필드 배열 항목 ID입니다. */
  fieldArrayId?: string;
};

/**
 * 스크롤 ref 저장에 사용할 필드 배열 항목 ID를 반환합니다.
 *
 * `useFieldArray`의 기본 `id`가 도메인 ID와 충돌하는 폼에서는
 * `fieldArrayId`를 우선 사용합니다.
 *
 * @param field 스크롤 대상으로 사용할 필드
 * @returns 스크롤 ref 저장 키
 */
function getScrollableFieldId(field: ScrollableField): string {
  return field.fieldArrayId ?? field.id ?? "";
}

/**
 * 요소를 기준으로 위로 순회하며 실제로 스크롤 가능한 조상 요소를 찾습니다.
 *
 * `overflow-y`가 auto/scroll이면서 콘텐츠가 실제로 넘치는 요소를 우선하고,
 * 찾지 못하면 document의 스크롤 요소를 최종 폴백으로 사용합니다.
 *
 * @param node 탐색을 시작할 DOM 노드
 * @returns 스크롤 가능한 요소
 */
function findScrollableAncestor(node: HTMLElement): HTMLElement {
  let current: HTMLElement | null = node.parentElement;

  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const canScrollY =
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight;

    if (canScrollY) {
      return current;
    }

    current = current.parentElement;
  }

  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

/**
 * 지정한 노드가 화면에 보이도록 스크롤 가능한 조상 요소를 클램프된 좌표로 스크롤합니다.
 *
 * @param node 스크롤 대상이 되는 카드의 DOM 노드
 */
function scrollCardIntoView(node: HTMLElement) {
  const scroller = findScrollableAncestor(node);
  const maxScrollTop = scroller.scrollHeight - scroller.clientHeight;

  const isDocumentScroller =
    scroller === document.scrollingElement ||
    scroller === document.documentElement;

  const targetTop = isDocumentScroller
    ? node.getBoundingClientRect().top + window.scrollY - 24
    : node.offsetTop - scroller.offsetTop - 24;

  scroller.scrollTo({
    top: Math.min(Math.max(targetTop, 0), maxScrollTop),
    behavior: "smooth",
  });
}

/**
 * 필드 배열에 새 항목이 추가되었을 때, 그 항목으로 스크롤을 이동시키는 훅입니다.
 *
 * `fields.length` 변화만으로는 초기 데이터 로딩(form.reset)과 실제 사용자의
 * 추가 동작을 구분할 수 없기 때문에, `markPendingScroll`을 명시적으로 호출한
 * 직후의 다음 렌더링에서만 스크롤을 실행합니다.
 *
 * @param fields 현재 폼에 등록된 필드 배열입니다.
 * @returns 스크롤 예약 함수와 카드 ref 등록 함수를 반환합니다.
 */
export function useScrollToNewlyAddedCard<T extends ScrollableField>(
  fields: T[],
) {
  /** 각 카드의 DOM 노드를 field.id 기준으로 보관하는 맵입니다. */
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  /**
   * 사용자가 방금 항목 추가 동작을 수행했는지 여부입니다.
   *
   * `markPendingScroll`이 호출된 직후에만 true가 되며,
   * 스크롤이 실행되면 다시 false로 초기화됩니다.
   */
  const pendingScrollRef = useRef(false);

  useEffect(() => {
    if (!pendingScrollRef.current || fields.length === 0) {
      return;
    }

    pendingScrollRef.current = false;

    const lastField = fields[fields.length - 1];

    if (!lastField) {
      return;
    }

    const fieldId = getScrollableFieldId(lastField);

    if (fieldId.length === 0) {
      return;
    }

    const node = cardRefs.current.get(fieldId);

    if (!node) {
      return;
    }

    /*
     * 레이아웃과 페인트가 완전히 끝난 뒤에 위치를 측정하기 위해
     * requestAnimationFrame을 두 번 중첩합니다.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollCardIntoView(node);
      });
    });
  }, [fields]);

  /**
   * 다음 렌더링에서 마지막 필드로 스크롤하도록 예약합니다.
   *
   * 항목을 추가하는 함수 호출 직전에 불러야 합니다.
   */
  function markPendingScroll() {
    pendingScrollRef.current = true;
  }

  /**
   * 카드의 DOM 노드를 ref 맵에 등록하거나 제거하는 콜백을 반환합니다.
   *
   * @param fieldId 등록할 필드의 ID
   * @returns ref 콜백 함수
   */
  function registerCardRef(fieldId: string) {
    return (node: HTMLDivElement | null) => {
      if (node) {
        cardRefs.current.set(fieldId, node);
      } else {
        cardRefs.current.delete(fieldId);
      }
    };
  }

  return { markPendingScroll, registerCardRef };
}
