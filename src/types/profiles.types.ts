import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type Profile = Row<"profiles">;
export type ProfileInsert = InsertDto<"profiles">;
export type ProfileUpdate = UpdateDto<"profiles">;

export type ProfileId = Profile["id"];
export type ProfileRole = Profile["role"];

export type ProfileSummary = Pick<
  Profile,
  "id" | "nickname" | "avatar_url" | "role"
>;

export type ProfileCreateInput = Omit<
  ProfileInsert,
  "created_at" | "updated_at"
>;
export type ProfilePatchInput = Partial<
  Pick<ProfileUpdate, "nickname" | "avatar_url" | "role">
>;
