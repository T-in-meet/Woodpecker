export type ActionResult<T = void> =
  | { data: T; error?: never }
  | { data?: never; error: string };

export type Nullable<T> = T | null;

export type Optional<T> = T | undefined;
