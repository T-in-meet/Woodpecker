import type {
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from "@/types/database.types";

export type { Database, Json };

export type SchemaName = keyof Omit<Database, "__InternalSupabase">;
export type PublicSchema = Database["public"];

export type TableName = keyof PublicSchema["Tables"];
export type ViewName = keyof PublicSchema["Views"];
export type FunctionName = keyof PublicSchema["Functions"];
export type EnumName = keyof PublicSchema["Enums"];

export type Row<T extends TableName> = Tables<T>;
export type InsertDto<T extends TableName> = TablesInsert<T>;
export type UpdateDto<T extends TableName> = TablesUpdate<T>;
export type DbEnum<T extends EnumName> = Enums<T>;

export type TableMap = {
  [K in TableName]: {
    row: Row<K>;
    insert: InsertDto<K>;
    update: UpdateDto<K>;
  };
};

type TableNameWithId = {
  [K in TableName]: Row<K> extends { id: unknown } ? K : never;
}[TableName];

export type IdOf<T extends TableNameWithId> = Row<T>["id"];

export type WithId<T extends TableNameWithId> = Pick<Row<T>, "id">;

export const TABLES = {
  aiEmbeddings: "ai_embeddings",
  aiModelConfigs: "ai_model_configs",
  aiPromptAgents: "ai_prompt_agents",
  aiPromptFamilies: "ai_prompt_families",
  aiPromptVersions: "ai_prompt_versions",
  feedbackReplies: "feedback_replies",
  feedbacks: "feedbacks",
  adminNotificationEvents: "admin_notification_events",
  adminNotificationReads: "admin_notification_reads",
  notes: "notes",
  notifications: "notifications",
  operationalErrorStatusHistory: "operational_error_status_history",
  operationalErrors: "operational_errors",
  profiles: "profiles",
  pushSubscriptions: "push_subscriptions",
  reviewLogs: "review_logs",
  userAgreements: "user_agreements",
  userLegalAcceptances: "user_legal_acceptances",
} as const;
