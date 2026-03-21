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

export type IdOf<T extends TableName> = Row<T>["id"];

export type WithId<T extends TableName> = Pick<Row<T>, "id">;

export const TABLES = {
  notes: "notes",
  notifications: "notifications",
  profiles: "profiles",
  pushSubscriptions: "push_subscriptions",
  reviewLogs: "review_logs",
} as const;
