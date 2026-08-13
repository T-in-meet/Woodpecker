export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  NOTES: "/notes",
  NOTES_NEW: "/notes/new",
  NOTES_TODAY: "/notes/today",
  MYPAGE: "/mypage",
  TERMS: "/terms",
  PRIVACY: "/privacy",
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

      NOTE_RELATIONS: {
        DASHBOARD: "/admin/experiments/note-relations",

        NOTE_RELATIONS: "/admin/experiments/note-relations/relations",

        PROMPTS: "/admin/experiments/note-relations/prompts",

        PROMPTS_NEW: "/admin/experiments/note-relations/prompts/new",

        KNOWLEDGE_EXTRACTIONS:
          "/admin/experiments/note-relations/knowledge-extractions",

        KNOWLEDGE_EXTRACTIONS_PREVIEW:
          "/admin/experiments/note-relations/knowledge-extractions/preview",

        KNOWLEDGE_EXTRACTIONS_NEW:
          "/admin/experiments/note-relations/knowledge-extractions/new",

        KNOWLEDGE_OBJECTS:
          "/admin/experiments/note-relations/knowledge-objects",

        KNOWLEDGE_OBJECTS_NEW:
          "/admin/experiments/note-relations/knowledge-objects/new",

        KNOWLEDGE_OBJECT_GENERATIONS:
          "/admin/experiments/note-relations/knowledge-object-generations",

        KNOWLEDGE_OBJECT_RELATIONS:
          "/admin/experiments/note-relations/knowledge-object-relations",

        KNOWLEDGE_OBJECT_RELATION_GENERATIONS:
          "/admin/experiments/note-relations/knowledge-object-relation-generations",

        KNOWLEDGE_OBJECT_RELATION_GENERATIONS_NEW:
          "/admin/experiments/note-relations/knowledge-object-relation-generations/new",
      },
    },
  },
} as const;

export type Route = (typeof ROUTES)[keyof typeof ROUTES];

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
 * @returns `/admin/ai/prompts/{familyId}/versions/new` 형식의 route path
 */
export function getAdminAiPromptVersionNewRoute(familyId: string) {
  return `${getAdminAiPromptFamilyRoute(familyId)}/versions/new`;
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
