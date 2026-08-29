export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  NOTES: "/notes",
  NOTES_NEW: "/notes/new",
  NOTES_TODAY: "/notes/today",

  NOTE_CHATS: "/note-chats",

  MYPAGE: "/mypage",
  TERMS: "/terms",
  PRIVACY: "/privacy",
  AGREEMENTS: "/agreements",
  CALLBACK: "/auth/callback",
  RESET_PASSWORD: "/reset-password",
  SET_PASSWORD: "/set-password",
  FORGOT_PASSWORD: "/forgot-password",
  VERIFY_OTP: "/verify-otp",
  RESEND_EMAIL: "/resend-email",

  ADMIN: {
    DASHBOARD: "/admin",

    USERS: "/admin/users",

    FEEDBACKS: "/admin/feedbacks",

    OPERATIONAL_ERRORS: "/admin/operational-errors",

    AI: {
      DASHBOARD: "/admin/ai",

      MODELS: "/admin/ai/models",

      MODELS_NEW: "/admin/ai/models/new",

      AGENTS: "/admin/ai/agents",

      AGENTS_NEW: "/admin/ai/agents/new",

      PROMPTS: "/admin/ai/prompts",

      PROMPTS_NEW: "/admin/ai/prompts/new",

      SETTINGS: "/admin/ai/settings",

      SETTINGS_NEW: "/admin/ai/settings/new",
    },

    EXPERIMENTS: {
      DASHBOARD: "/admin/experiments",

      COMPONENT_PLAYGROUND: "/admin/experiments/component-playground",
    },
  },
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * 내비게이션 메뉴 항목이 현재 경로에 해당하는지 판정합니다.
 *
 * 데스크톱(`NotesNav`)과 모바일(`MobileMenu`)이 같은 기준을 써야 하므로
 * 판정 로직을 한 곳에 둡니다. 노트 목록은 상세 등 하위 경로까지 포함하되
 * 노트 작성 경로는 제외합니다.
 *
 * @param pathname 현재 경로
 * @param href 메뉴 항목의 경로
 * @returns 현재 경로가 해당 메뉴 항목에 해당하면 `true`
 */
export function isCurrentNavRoute(pathname: string, href: string): boolean {
  if (href === ROUTES.NOTES) {
    return (
      pathname.startsWith(ROUTES.NOTES) &&
      pathname !== ROUTES.NOTES_NEW &&
      !pathname.startsWith(ROUTES.NOTE_CHATS)
    );
  }

  if (href === ROUTES.NOTE_CHATS) {
    return pathname.startsWith(ROUTES.NOTE_CHATS);
  }

  return pathname === href;
}

export function getNoteDetailRoute(noteId: string) {
  return `${ROUTES.NOTES}/${noteId}`;
}

export function getNoteReviewRoute(noteId: string) {
  return `${getNoteDetailRoute(noteId)}/review`;
}

/**
 * 관리자 피드백 상세 페이지 경로를 생성합니다.
 *
 * @param feedbackId 상세 조회할 feedbacks.id
 * @returns `/admin/feedbacks/{feedbackId}` 형식의 route path
 */
export function getAdminFeedbackDetailRoute(feedbackId: string) {
  return `${ROUTES.ADMIN.FEEDBACKS}/${feedbackId}`;
}

export function getAdminOperationalErrorDetailRoute(
  operationalErrorId: string,
) {
  return `${ROUTES.ADMIN.OPERATIONAL_ERRORS}/${operationalErrorId}`;
}

/**
 * 관리자 AI 모델 상세 페이지 경로를 생성합니다.
 *
 * @param modelConfigId 상세 조회할 ai_model_configs.id
 * @returns `/admin/ai/models/{modelConfigId}` 형식의 route path
 */
export function getAdminAiModelRoute(modelConfigId: string) {
  return `${ROUTES.ADMIN.AI.MODELS}/${modelConfigId}`;
}

/**
 * 관리자 AI agent 상세 페이지 경로를 생성합니다.
 *
 * @param agentId 상세 조회할 ai_prompt_agents.id
 * @returns `/admin/ai/agents/{agentId}` 형식의 route path
 */
export function getAdminAiAgentRoute(agentId: string) {
  return `${ROUTES.ADMIN.AI.AGENTS}/${agentId}`;
}

/**
 * 관리자 AI prompt family 상세 페이지 경로를 생성합니다.
 *
 * @param familyId 상세 조회할 ai_prompt_families.id
 * @returns `/admin/ai/prompts/{familyId}` 형식의 route path
 */
export function getAdminAiPromptFamilyRoute(familyId: string) {
  return `${ROUTES.ADMIN.AI.PROMPTS}/${familyId}`;
}

/**
 * 관리자 AI prompt version 생성 페이지 경로를 생성합니다.
 *
 * @param familyId version을 생성할 ai_prompt_families.id
 * @param sourceVersionId 생성 폼 기본값으로 복사할 ai_prompt_versions.id
 * @returns `/admin/ai/prompts/{familyId}/versions/new` 형식의 route path
 */
export function getAdminAiPromptVersionNewRoute(
  familyId: string,
  sourceVersionId?: string,
) {
  const route = `${getAdminAiPromptFamilyRoute(familyId)}/versions/new`;

  if (sourceVersionId === undefined) {
    return route;
  }

  return `${route}?sourceVersionId=${encodeURIComponent(sourceVersionId)}`;
}

/**
 * 관리자 AI prompt version 상세 페이지 경로를 생성합니다.
 *
 * @param familyId version이 속한 ai_prompt_families.id
 * @param versionId 상세 조회할 ai_prompt_versions.id
 * @returns `/admin/ai/prompts/{familyId}/versions/{versionId}` 형식의 route path
 */
export function getAdminAiPromptVersionRoute(
  familyId: string,
  versionId: string,
) {
  return `${getAdminAiPromptFamilyRoute(familyId)}/versions/${versionId}`;
}

/**
 * AI 설정 상세 페이지 경로를 생성합니다.
 *
 * @param settingId AI 설정의 고유 ID입니다.
 * @returns AI 설정 상세 페이지 경로입니다.
 */
export function getAdminAiSettingsRoute(settingId: string) {
  return `${ROUTES.ADMIN.AI.SETTINGS}/${settingId}`;
}

/**
 * 노트 챗봇 대화 상세 페이지 경로를 생성합니다.
 *
 * @param conversationId 노트 챗봇 대화 ID
 * @returns `/note-chats/{conversationId}` 형식의 route path
 */
export function getNoteChatConversationRoute(conversationId: string) {
  return `${ROUTES.NOTE_CHATS}/${conversationId}`;
}
