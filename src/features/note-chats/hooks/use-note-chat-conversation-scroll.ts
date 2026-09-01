"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/**
 * 이전 메시지를 조회할 상단 근접 거리입니다.
 *
 * 이전 메시지 자동 조회를 시작하기 위한 기존 동작 기준이며,
 * 최신 메시지 표시 여부 판단에는 사용하지 않습니다.
 */
const PREVIOUS_MESSAGE_LOAD_THRESHOLD_PX = 48;

/**
 * DOM 측정 오차로 최신 메시지 표시 상태가 반복해서 바뀌는 것을 방지하기 위한 허용값입니다.
 */
const LATEST_MESSAGE_VISIBILITY_TOLERANCE_PX = 1;

/**
 * Note Chat Conversation 스크롤 Hook의 입력값입니다.
 */
type UseNoteChatConversationScrollParams = {
  /** 현재 Conversation ID입니다. */
  conversationId: string;

  /** Conversation 영역의 계산된 높이입니다. */
  conversationHeight: number | null;

  /**
   * 현재 pending User Question과 대응하는 저장 Message ID입니다.
   *
   * 새 질문은 서버에서 Message ID가 확인되기 전까지 null이며,
   * 확인된 이후에는 pending DOM과 stored DOM 사이에서 scroll 기준을 이어받는 데 사용합니다.
   *
   * 질문 수정은 기존 User Message ID를 그대로 사용하므로
   * stored DOM에서 pending DOM으로 전환할 때도 동일한 semantic target을 유지합니다.
   */
  pendingQuestionMessageId: string | null;

  /** 이전에 불러올 메시지가 남아 있는지 여부입니다. */
  hasPreviousMessages: boolean;

  /** Conversation 상세와 최초 메시지 조회가 준비되었는지 여부입니다. */
  hasDetail: boolean;

  /** 이전 메시지를 현재 불러오는 중인지 여부입니다. */
  isFetchingPreviousMessages: boolean;

  /** 이전 메시지 페이지를 추가로 조회합니다. */
  onLoadPreviousMessages: () => Promise<unknown>;
};

/**
 * prepend 전 화면에 보이던 DOM 요소와 viewport 내 위치입니다.
 */
type VisualAnchor = {
  /** prepend 전부터 화면에 존재하던 DOM 요소입니다. */
  element: HTMLElement;

  /** viewport 상단을 기준으로 한 요소의 top 위치입니다. */
  top: number;
};

/**
 * User Question 스크롤 대상입니다.
 *
 * null은 아직 저장되지 않은 pending 질문을 의미하고,
 * string은 저장된 User Message ID를 의미합니다.
 */
type QuestionScrollTarget = string | null;

/**
 * Note Chat Conversation의 스크롤 정책을 관리합니다.
 *
 * 최초 진입과 Conversation 전환에서는 최신 메시지 위치로 이동합니다.
 * 새 질문, 질문 수정, 답변 재시도는 명시적인 semantic command를 통해
 * 대상 User Question을 ScrollArea viewport 시작점에 배치합니다.
 *
 * 기본 상태에서는 Assistant 답변의 생성 및 UI 높이 변화로 viewport를
 * 자동 이동하지 않습니다. 사용자가 최신 메시지 컨트롤을 선택한 경우에만
 * follow 상태를 활성화하고 이후 콘텐츠 증가를 최신 위치까지 따라갑니다.
 *
 * 질문 실행 중에는 동일 질문의 pending/stored DOM 전환에서도
 * semantic target을 유지하고 실제 DOM 기준만 현재 요소로 이어받습니다.
 *
 * 사용자가 follow 중 실제 viewport를 위쪽으로 이동하면
 * 입력 방식과 관계없이 follow를 종료합니다.
 *
 * 이전 메시지를 prepend할 때는 기존 화면에 보이던 DOM 요소를 visual anchor로
 * 사용하여 같은 요소가 같은 viewport 위치에 유지되도록 보정합니다.
 *
 * @param params Hook 입력값
 * @param params.conversationId 현재 Conversation ID
 * @param params.conversationHeight Conversation 영역의 계산된 높이
 * @param params.pendingQuestionMessageId 현재 pending 질문과 대응하는 저장 Message ID
 * @param params.hasPreviousMessages 이전에 불러올 메시지가 남아 있는지 여부
 * @param params.hasDetail Conversation 상세와 최초 메시지 조회 준비 여부
 * @param params.isFetchingPreviousMessages 이전 메시지 조회 진행 여부
 * @param params.onLoadPreviousMessages 이전 메시지 페이지 조회 함수
 * @returns Conversation 스크롤 상태와 semantic scroll API
 */
export function useNoteChatConversationScroll({
  conversationId,
  conversationHeight,
  pendingQuestionMessageId,
  hasPreviousMessages,
  hasDetail,
  isFetchingPreviousMessages,
  onLoadPreviousMessages,
}: UseNoteChatConversationScrollParams) {
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  /** 저장된 User Message ID별 DOM 요소입니다. */
  const storedUserMessageElementsRef = useRef(new Map<string, HTMLLIElement>());

  /** 아직 저장되지 않은 pending User Question DOM 요소입니다. */
  const pendingUserMessageElementRef = useRef<HTMLLIElement | null>(null);

  /** 렌더링을 기다리고 있는 User Question semantic scroll 대상입니다. */
  const pendingQuestionScrollTargetRef = useRef<
    QuestionScrollTarget | undefined
  >(undefined);

  /** 현재 viewport 시작점 기준으로 유지 중인 User Question입니다. */
  const activeQuestionScrollTargetRef = useRef<
    QuestionScrollTarget | undefined
  >(undefined);

  /** 질문 TOP 정렬 상태에서 필요한 하단 여백을 계산할 기준 요소입니다. */
  const activeQuestionTopElementRef = useRef<HTMLLIElement | null>(null);

  /**
   * active 질문 정렬 작업의 최신 version입니다.
   *
   * pending/stored DOM이 빠르게 교체되거나 Conversation/latest 상태가 바뀔 때
   * 이전 requestAnimationFrame 정렬 작업이 최신 상태에 개입하지 못하도록 합니다.
   */
  const activeQuestionAlignmentVersionRef = useRef(0);

  /** Conversation 최초 최신 위치 이동 완료 여부입니다. */
  const hasInitialScrolledRef = useRef(false);

  /** 이전 메시지 조회 중 보존할 visual anchor 후보입니다. */
  const prependVisualAnchorsRef = useRef<VisualAnchor[]>([]);

  /** 중복 이전 메시지 조회를 막기 위한 로컬 실행 guard입니다. */
  const isLoadingPreviousMessagesRef = useRef(false);

  /** 사용자가 명시적으로 활성화한 최신 답변 follow 상태입니다. */
  const isFollowingLatestRef = useRef(false);

  /**
   * 직전에 확인한 viewport의 실제 scrollTop입니다.
   *
   * follow 중 wheel/touch/key 입력이 아닌 scrollbar thumb/track 등의 방식으로
   * viewport가 위쪽으로 이동한 경우에도 follow를 종료할 수 있도록 사용합니다.
   */
  const lastScrollTopRef = useRef(0);

  /** touch 스크롤에서 사용자의 위 방향 이동을 판별하기 위한 시작 Y 좌표입니다. */
  const touchStartYRef = useRef<number | null>(null);

  /** 질문을 정확히 viewport 시작점에 둘 수 있도록 추가할 하단 여백입니다. */
  const [questionBottomSpacerHeight, setQuestionBottomSpacerHeight] =
    useState(0);

  /** 실제 최신 메시지 anchor가 viewport 밖에 있는지 여부입니다. */
  const [shouldShowLatestMessageButton, setShouldShowLatestMessageButton] =
    useState(false);

  /**
   * 현재 최신 메시지 anchor의 viewport 노출 여부를 계산합니다.
   *
   * @param viewport 실제 ScrollArea viewport
   */
  const updateLatestMessageButtonVisibility = useCallback(
    (viewport: HTMLDivElement) => {
      const messageEnd = messageEndRef.current;

      if (!messageEnd) {
        setShouldShowLatestMessageButton(false);
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const messageEndRect = messageEnd.getBoundingClientRect();

      const isLatestOutsideViewport =
        messageEndRect.top >
          viewportRect.bottom + LATEST_MESSAGE_VISIBILITY_TOLERANCE_PX ||
        messageEndRect.bottom <
          viewportRect.top - LATEST_MESSAGE_VISIBILITY_TOLERANCE_PX;

      setShouldShowLatestMessageButton(isLatestOutsideViewport);
    },
    [],
  );

  /**
   * 현재 질문 TOP 정렬에 필요한 하단 여백을 다시 계산합니다.
   *
   * 실제 최신 메시지 anchor는 spacer 앞에 위치하므로,
   * 답변이 길어질수록 필요한 spacer만 자연스럽게 감소합니다.
   *
   * pending/stored 질문이 서로 교체되는 짧은 구간에는
   * 기존 DOM이 먼저 분리될 수 있으므로 연결이 끊긴 요소로는
   * spacer를 다시 계산하지 않습니다.
   */
  const updateQuestionBottomSpacer = useCallback(() => {
    const viewport = scrollViewportRef.current;
    const question = activeQuestionTopElementRef.current;
    const messageEnd = messageEndRef.current;

    if (!viewport || !question || !messageEnd) {
      setQuestionBottomSpacerHeight(0);
      return;
    }

    if (!question.isConnected) {
      return;
    }

    const questionRect = question.getBoundingClientRect();
    const messageEndRect = messageEnd.getBoundingClientRect();

    const actualContentHeightBelowQuestion = Math.max(
      0,
      messageEndRect.top - questionRect.top,
    );

    const nextSpacerHeight = Math.max(
      0,
      viewport.clientHeight - actualContentHeightBelowQuestion,
    );

    setQuestionBottomSpacerHeight((current) =>
      Math.abs(current - nextSpacerHeight) <
      LATEST_MESSAGE_VISIBILITY_TOLERANCE_PX
        ? current
        : nextSpacerHeight,
    );
  }, []);

  /**
   * 실제 User Question DOM 요소를 viewport 시작점에 맞춥니다.
   *
   * semantic target이나 follow 상태는 변경하지 않고
   * 현재 DOM의 실제 위치만 보정합니다.
   *
   * @param element viewport 시작점에 배치할 User Question DOM 요소
   */
  const alignElementToViewportStart = useCallback(
    (element: HTMLLIElement) => {
      const viewport = scrollViewportRef.current;

      if (!viewport || !element.isConnected) {
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();

      viewport.scrollTop += elementRect.top - viewportRect.top;
      lastScrollTopRef.current = viewport.scrollTop;

      updateLatestMessageButtonVisibility(viewport);
    },
    [updateLatestMessageButtonVisibility],
  );

  /**
   * 대상 User Question을 현재 ScrollArea viewport 시작점에 맞춥니다.
   *
   * semantic command를 시작하면서 active target과 실제 DOM 기준을 설정하고,
   * spacer 계산 후 다음 frame에서 현재 상태가 여전히 유효한 경우에만
   * 실제 viewport 위치를 보정합니다.
   *
   * @param target 정렬할 User Question semantic target
   * @param element viewport 시작점에 배치할 User Question DOM 요소
   */
  const alignQuestionToViewportStart = useCallback(
    (target: QuestionScrollTarget, element: HTMLLIElement) => {
      const viewport = scrollViewportRef.current;

      if (!viewport) {
        return;
      }

      isFollowingLatestRef.current = false;
      activeQuestionScrollTargetRef.current = target;
      activeQuestionTopElementRef.current = element;

      const alignmentVersion = ++activeQuestionAlignmentVersionRef.current;

      updateQuestionBottomSpacer();

      window.requestAnimationFrame(() => {
        if (
          activeQuestionAlignmentVersionRef.current !== alignmentVersion ||
          activeQuestionScrollTargetRef.current !== target ||
          activeQuestionTopElementRef.current !== element ||
          !element.isConnected
        ) {
          return;
        }

        alignElementToViewportStart(element);
      });
    },
    [alignElementToViewportStart, updateQuestionBottomSpacer],
  );

  /**
   * 동일한 active User Question의 실제 DOM이 pending/stored 전환으로
   * 교체된 뒤 질문 TOP 정렬을 복원합니다.
   *
   * 새 DOM 기준으로 spacer를 다시 계산하고, spacer가 DOM에 반영될 수 있도록
   * 다음 frame까지 기다린 뒤 현재 target과 element가 여전히 최신인 경우에만
   * viewport 시작점 정렬을 수행합니다.
   *
   * @param target 현재 유지 중인 User Question semantic target
   * @param element 새로 등록된 User Question DOM 요소
   */
  const restoreActiveQuestionAlignmentAfterElementHandoff = useCallback(
    (target: QuestionScrollTarget, element: HTMLLIElement) => {
      if (
        activeQuestionScrollTargetRef.current !== target ||
        activeQuestionTopElementRef.current === element
      ) {
        return;
      }

      activeQuestionTopElementRef.current = element;

      const alignmentVersion = ++activeQuestionAlignmentVersionRef.current;

      updateQuestionBottomSpacer();

      window.requestAnimationFrame(() => {
        if (
          activeQuestionAlignmentVersionRef.current !== alignmentVersion ||
          activeQuestionScrollTargetRef.current !== target ||
          activeQuestionTopElementRef.current !== element ||
          !element.isConnected
        ) {
          return;
        }

        alignElementToViewportStart(element);
      });
    },
    [alignElementToViewportStart, updateQuestionBottomSpacer],
  );

  /**
   * 현재 등록된 User Question 중 semantic target에 대응하는 요소를 찾습니다.
   *
   * @param target 저장된 Message ID 또는 pending 질문을 의미하는 null
   * @returns 현재 렌더링된 User Question DOM 요소
   */
  const getQuestionElement = useCallback(
    (target: QuestionScrollTarget): HTMLLIElement | null => {
      if (target === null) {
        return pendingUserMessageElementRef.current;
      }

      return storedUserMessageElementsRef.current.get(target) ?? null;
    },
    [],
  );

  /**
   * 렌더링 대기 중인 질문 스크롤 명령을 실행할 수 있으면 처리합니다.
   */
  const flushPendingQuestionScroll = useCallback(() => {
    const target = pendingQuestionScrollTargetRef.current;

    if (target === undefined) {
      return;
    }

    const element = getQuestionElement(target);

    if (!element) {
      return;
    }

    pendingQuestionScrollTargetRef.current = undefined;
    alignQuestionToViewportStart(target, element);
  }, [alignQuestionToViewportStart, getQuestionElement]);

  /**
   * User Message DOM 요소를 semantic scroll 대상 저장소에 등록합니다.
   *
   * 새 질문의 pending → stored 전환과
   * 기존 질문 수정의 stored → pending → stored 전환 모두
   * 동일한 semantic target을 유지하면서 실제 DOM 기준을 현재 요소로 이어받습니다.
   *
   * active 질문의 실제 DOM이 교체된 경우에는 새 DOM 기준으로 spacer를 다시 계산하고
   * TOP 정렬을 복원하여 콘텐츠 축소로 scrollTop이 clamp된 경우에도
   * 동일 질문의 viewport 시작점 위치를 유지합니다.
   *
   * @param messageId 저장된 User Message ID, pending 질문이면 null
   * @param element 현재 렌더링된 User Message DOM 요소
   */
  const registerUserMessageElement = useCallback(
    (messageId: string | null, element: HTMLLIElement | null) => {
      if (messageId === null) {
        pendingUserMessageElementRef.current = element;

        /*
         * 새 질문은 active target이 null인 상태에서 pending DOM을 사용합니다.
         *
         * 질문 수정은 기존 저장 Message ID를 semantic target으로 유지하므로,
         * pendingQuestionMessageId와 active target이 같은 경우에는
         * stored → pending DOM handoff로 취급합니다.
         */
        if (element !== null) {
          if (activeQuestionScrollTargetRef.current === null) {
            restoreActiveQuestionAlignmentAfterElementHandoff(null, element);
          } else if (
            pendingQuestionMessageId !== null &&
            activeQuestionScrollTargetRef.current === pendingQuestionMessageId
          ) {
            restoreActiveQuestionAlignmentAfterElementHandoff(
              pendingQuestionMessageId,
              element,
            );
          }
        }
      } else if (element) {
        storedUserMessageElementsRef.current.set(messageId, element);

        /*
         * pending 질문의 저장 ID가 확인된 뒤 stored DOM이 등록되면
         * 동일 질문의 TOP 정렬 기준을 새 DOM으로 이어받습니다.
         *
         * 질문 수정에서도 semantic target은 기존 Message ID를 유지하므로,
         * 실행 완료 후 다시 등록되는 stored DOM으로 동일하게 복귀합니다.
         */
        if (activeQuestionScrollTargetRef.current === messageId) {
          restoreActiveQuestionAlignmentAfterElementHandoff(messageId, element);
        } else if (
          activeQuestionScrollTargetRef.current === null &&
          pendingQuestionMessageId === messageId
        ) {
          activeQuestionScrollTargetRef.current = messageId;

          restoreActiveQuestionAlignmentAfterElementHandoff(messageId, element);
        }
      } else {
        storedUserMessageElementsRef.current.delete(messageId);
      }

      flushPendingQuestionScroll();
    },
    [
      flushPendingQuestionScroll,
      pendingQuestionMessageId,
      restoreActiveQuestionAlignmentAfterElementHandoff,
    ],
  );

  /**
   * pending 질문의 저장 Message ID가 확인되면
   * 현재 질문 TOP 정렬의 semantic target을 저장 Message ID로 승격합니다.
   *
   * 실제 DOM은 pending 질문을 계속 사용하다가,
   * 같은 ID의 stored User Message가 등록되는 순간 새 DOM으로 이어받습니다.
   */
  useEffect(() => {
    if (
      pendingQuestionMessageId === null ||
      activeQuestionScrollTargetRef.current !== null
    ) {
      return;
    }

    activeQuestionScrollTargetRef.current = pendingQuestionMessageId;

    const storedElement = storedUserMessageElementsRef.current.get(
      pendingQuestionMessageId,
    );

    if (storedElement) {
      restoreActiveQuestionAlignmentAfterElementHandoff(
        pendingQuestionMessageId,
        storedElement,
      );
    }
  }, [
    pendingQuestionMessageId,
    restoreActiveQuestionAlignmentAfterElementHandoff,
  ]);

  /**
   * User Question을 ScrollArea viewport 시작점으로 이동하도록 예약합니다.
   *
   * 새 질문처럼 target DOM이 아직 렌더링되지 않은 경우에는
   * 등록 시점까지 명령을 보존했다가 즉시 실행합니다.
   *
   * 저장된 기존 질문은 현재 등록된 DOM을 즉시 사용합니다.
   *
   * @param messageId 저장된 User Message ID, pending 질문이면 null
   */
  const scrollQuestionToViewportStart = useCallback(
    (messageId: string | null) => {
      isFollowingLatestRef.current = false;
      pendingQuestionScrollTargetRef.current = messageId;

      const element = getQuestionElement(messageId);

      if (!element) {
        return;
      }

      pendingQuestionScrollTargetRef.current = undefined;
      alignQuestionToViewportStart(messageId, element);
    },
    [alignQuestionToViewportStart, getQuestionElement],
  );

  /**
   * 최신 메시지 위치로 이동하고 이후 콘텐츠 증가 follow를 활성화합니다.
   */
  const scrollToLatestMessage = useCallback(() => {
    const viewport = scrollViewportRef.current;

    isFollowingLatestRef.current = true;
    pendingQuestionScrollTargetRef.current = undefined;
    activeQuestionScrollTargetRef.current = undefined;
    activeQuestionTopElementRef.current = null;

    /*
     * latest 이동을 시작하기 직전의 실제 scrollTop을 기준값으로 저장합니다.
     *
     * 이후 smooth scroll에서 발생하는 scroll 이벤트는 아래 방향 이동이므로
     * follow 상태를 유지하면서 lastScrollTop을 자연스럽게 갱신합니다.
     */
    if (viewport) {
      lastScrollTopRef.current = viewport.scrollTop;
    }

    /*
     * 이전 active 질문의 예약된 TOP 정렬 작업을 무효화합니다.
     */
    activeQuestionAlignmentVersionRef.current += 1;

    setQuestionBottomSpacerHeight(0);

    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });

    if (viewport) {
      window.requestAnimationFrame(() => {
        const latestViewport = scrollViewportRef.current;

        if (latestViewport) {
          updateLatestMessageButtonVisibility(latestViewport);
        }
      });
    }
  }, [updateLatestMessageButtonVisibility]);

  /**
   * 현재 최신 메시지 follow를 해제합니다.
   *
   * 답변 표시 중지처럼 semantic event가 명시적으로 follow를 종료해야 할 때 사용합니다.
   */
  const stopFollowingLatest = useCallback(() => {
    isFollowingLatestRef.current = false;
  }, []);

  /**
   * prepend 전에 현재 viewport에 보이는 기존 DOM 요소들을 visual anchor 후보로 저장합니다.
   *
   * 첫 번째 후보가 로딩 상태 UI처럼 prepend 중 제거되더라도
   * 다음으로 계속 연결되어 있는 기존 메시지를 사용할 수 있도록 여러 후보를 보존합니다.
   *
   * @param viewport 실제 ScrollArea viewport
   */
  const capturePrependVisualAnchors = useCallback(
    (viewport: HTMLDivElement) => {
      const viewportRect = viewport.getBoundingClientRect();

      prependVisualAnchorsRef.current = Array.from(
        viewport.querySelectorAll<HTMLElement>("li"),
      )
        .filter((element) => {
          const rect = element.getBoundingClientRect();

          return (
            rect.bottom > viewportRect.top && rect.top < viewportRect.bottom
          );
        })
        .map((element) => ({
          element,
          top: element.getBoundingClientRect().top - viewportRect.top,
        }));
    },
    [],
  );

  /**
   * prepend 전 저장한 visual anchor를 현재 viewport의 같은 위치로 복원합니다.
   */
  const restorePrependVisualAnchor = useCallback(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport || prependVisualAnchorsRef.current.length === 0) {
      return;
    }

    const anchor = prependVisualAnchorsRef.current.find(
      ({ element }) => element.isConnected && viewport.contains(element),
    );

    if (!anchor) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const currentTop =
      anchor.element.getBoundingClientRect().top - viewportRect.top;

    viewport.scrollTop += currentTop - anchor.top;
    lastScrollTopRef.current = viewport.scrollTop;

    updateLatestMessageButtonVisibility(viewport);
  }, [updateLatestMessageButtonVisibility]);

  /**
   * 이전 메시지를 조회합니다.
   *
   * 조회 직전에 visual anchor를 저장하고,
   * Query의 loading/완료 렌더 단계마다 같은 anchor 위치를 복원합니다.
   */
  const loadPreviousMessages = useCallback(async () => {
    const viewport = scrollViewportRef.current;

    if (
      !viewport ||
      !hasPreviousMessages ||
      isFetchingPreviousMessages ||
      isLoadingPreviousMessagesRef.current
    ) {
      return;
    }

    isLoadingPreviousMessagesRef.current = true;
    capturePrependVisualAnchors(viewport);

    try {
      await onLoadPreviousMessages();
    } finally {
      window.requestAnimationFrame(() => {
        restorePrependVisualAnchor();

        prependVisualAnchorsRef.current = [];
        isLoadingPreviousMessagesRef.current = false;

        const latestViewport = scrollViewportRef.current;

        if (latestViewport) {
          updateLatestMessageButtonVisibility(latestViewport);
        }
      });
    }
  }, [
    capturePrependVisualAnchors,
    hasPreviousMessages,
    isFetchingPreviousMessages,
    onLoadPreviousMessages,
    restorePrependVisualAnchor,
    updateLatestMessageButtonVisibility,
  ]);

  /**
   * 이전 메시지 loading 상태가 DOM에 반영되는 각 layout 단계에서
   * 저장된 visual anchor 위치를 paint 전에 복원합니다.
   */
  useLayoutEffect(() => {
    restorePrependVisualAnchor();
  }, [isFetchingPreviousMessages, restorePrependVisualAnchor]);

  /**
   * 현재 viewport의 실제 스크롤 방향을 추적하고,
   * 최신 메시지 노출 상태와 이전 메시지 조회 조건을 갱신합니다.
   *
   * follow 상태에서 실제 scrollTop이 이전 값보다 위쪽으로 감소하면
   * wheel/touch/key 입력 여부와 관계없이 사용자가 최신 위치를 이탈한 것으로 보고
   * follow를 종료합니다.
   */
  const handleViewportScroll = useCallback(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport) {
      return;
    }

    const previousScrollTop = lastScrollTopRef.current;
    const currentScrollTop = viewport.scrollTop;

    if (
      isFollowingLatestRef.current &&
      currentScrollTop <
        previousScrollTop - LATEST_MESSAGE_VISIBILITY_TOLERANCE_PX
    ) {
      isFollowingLatestRef.current = false;
    }

    lastScrollTopRef.current = currentScrollTop;

    updateLatestMessageButtonVisibility(viewport);

    if (viewport.scrollTop <= PREVIOUS_MESSAGE_LOAD_THRESHOLD_PX) {
      void loadPreviousMessages();
    }
  }, [loadPreviousMessages, updateLatestMessageButtonVisibility]);

  /**
   * Conversation이 바뀌면 기존 semantic scroll 상태를 초기화합니다.
   */
  useEffect(() => {
    hasInitialScrolledRef.current = false;
    isFollowingLatestRef.current = false;
    lastScrollTopRef.current = 0;
    pendingQuestionScrollTargetRef.current = undefined;
    activeQuestionScrollTargetRef.current = undefined;
    activeQuestionTopElementRef.current = null;

    /*
     * 이전 Conversation에서 예약된 active 질문 정렬을 무효화합니다.
     */
    activeQuestionAlignmentVersionRef.current += 1;

    prependVisualAnchorsRef.current = [];
    storedUserMessageElementsRef.current.clear();
    pendingUserMessageElementRef.current = null;
    setQuestionBottomSpacerHeight(0);
    setShouldShowLatestMessageButton(false);
  }, [conversationId]);

  /**
   * 최초 Conversation과 대화 영역 높이가 준비되면
   * 레이아웃 반영 후 최신 메시지 위치로 한 번 이동합니다.
   *
   * 최초 최신 위치 이동은 follow 상태를 활성화하지 않습니다.
   */
  useEffect(() => {
    if (
      hasInitialScrolledRef.current ||
      !hasDetail ||
      conversationHeight === null
    ) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const viewport = scrollViewportRef.current;
      const messageEnd = messageEndRef.current;

      if (!viewport || !messageEnd) {
        return;
      }

      activeQuestionScrollTargetRef.current = undefined;
      activeQuestionTopElementRef.current = null;
      activeQuestionAlignmentVersionRef.current += 1;
      setQuestionBottomSpacerHeight(0);

      messageEnd.scrollIntoView({
        behavior: "auto",
        block: "end",
      });

      lastScrollTopRef.current = viewport.scrollTop;
      hasInitialScrolledRef.current = true;

      updateLatestMessageButtonVisibility(viewport);
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [
    conversationHeight,
    conversationId,
    hasDetail,
    updateLatestMessageButtonVisibility,
  ]);

  /**
   * 실제 메시지 콘텐츠 높이 변화를 관찰합니다.
   *
   * prepend 중이면 기존 visual anchor를 먼저 복원합니다.
   *
   * follow 상태이면 최신 위치를 유지하고,
   * follow가 꺼져 있으면 viewport를 움직이지 않은 채 최신 메시지 노출 상태만 갱신합니다.
   */
  useEffect(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport || !hasDetail) {
      return;
    }

    const contentElement = viewport.firstElementChild;

    if (!(contentElement instanceof HTMLElement)) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      restorePrependVisualAnchor();
      updateQuestionBottomSpacer();

      if (isFollowingLatestRef.current) {
        messageEndRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });
      }

      updateLatestMessageButtonVisibility(viewport);
    });

    resizeObserver.observe(contentElement);

    const handleWindowResize = () => {
      updateQuestionBottomSpacer();

      if (isFollowingLatestRef.current) {
        messageEndRef.current?.scrollIntoView({
          behavior: "auto",
          block: "end",
        });
      }

      updateLatestMessageButtonVisibility(viewport);
    };

    window.addEventListener("resize", handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [
    conversationHeight,
    hasDetail,
    restorePrependVisualAnchor,
    updateLatestMessageButtonVisibility,
    updateQuestionBottomSpacer,
  ]);

  /**
   * 사용자의 직접적인 위 방향 스크롤 입력을 감지하여 follow를 종료합니다.
   *
   * wheel/touch/key 입력은 실제 scroll 이벤트보다 먼저 follow를 종료할 수 있도록
   * 기존 입력 기반 처리를 유지합니다.
   *
   * scrollbar thumb/track처럼 이 입력 이벤트를 거치지 않는 이동은
   * handleViewportScroll에서 실제 scrollTop 감소를 통해 별도로 감지합니다.
   */
  useEffect(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport || !hasDetail) {
      return;
    }

    const stopFollowForUpwardInput = () => {
      if (isFollowingLatestRef.current) {
        isFollowingLatestRef.current = false;
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        stopFollowForUpwardInput();
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touchStartY = touchStartYRef.current;
      const currentY = event.touches[0]?.clientY;

      if (
        touchStartY !== null &&
        currentY !== undefined &&
        currentY > touchStartY
      ) {
        stopFollowForUpwardInput();
      }

      if (currentY !== undefined) {
        touchStartYRef.current = currentY;
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowUp" ||
        event.key === "PageUp" ||
        event.key === "Home"
      ) {
        stopFollowForUpwardInput();
      }
    };

    viewport.addEventListener("wheel", handleWheel, { passive: true });
    viewport.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: true });
    viewport.addEventListener("touchend", handleTouchEnd, { passive: true });
    viewport.addEventListener("keydown", handleKeyDown);

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("keydown", handleKeyDown);
    };
  }, [conversationHeight, hasDetail]);

  return {
    handleViewportScroll,
    messageEndRef,
    questionBottomSpacerHeight,
    registerUserMessageElement,
    scrollQuestionToViewportStart,
    scrollToLatestMessage,
    scrollViewportRef,
    shouldShowLatestMessageButton,
    stopFollowingLatest,
  };
}
