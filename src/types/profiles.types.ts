import type { InsertDto, Row, UpdateDto } from "@/types/db.helpers";

export type ProfileRole = "USER" | "ADMIN";

type ProfileRow = Omit<Row<"profiles">, "role"> & {
  role: ProfileRole;
};

export type Profile = ProfileRow;
export type ProfileInsert = InsertDto<"profiles">;
export type ProfileUpdate = UpdateDto<"profiles">;

export type ProfileId = Profile["id"];

export type ProfileSummary = Pick<
  Profile,
  "id" | "nickname" | "avatar_url" | "role"
>;

export type ProfileCreateInput = Omit<
  ProfileInsert,
  "created_at" | "updated_at" | "role"
> & {
  role?: ProfileRole;
};

export type ProfilePatchInput = Partial<Omit<ProfileUpdate, "role">> & {
  role?: ProfileRole;
};
