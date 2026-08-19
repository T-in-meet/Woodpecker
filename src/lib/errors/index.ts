export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource}을(를) 찾을 수 없습니다`, "NOT_FOUND", 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("인증이 필요합니다", "UNAUTHORIZED", 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor() {
    super("권한이 없습니다", "FORBIDDEN", 403);
    this.name = "ForbiddenError";
  }
}
