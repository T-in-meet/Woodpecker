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
  FORGOT_PASSWORD: "/forgot-password",
  VERIFY_OTP: "/verify-otp",
  RESEND_EMAIL: "/resend-email",

  ADMIN: {
    DASHBOARD: "/admin",

    USERS: "/admin/users",

    FEEDBACK: "/admin/feedback",

    FEATURES: "/admin/features",

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
