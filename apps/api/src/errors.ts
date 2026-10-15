import type { Context } from "hono";
import { ZodError } from "zod";

/** 統一したエラーの形: { error: { code, message } } */
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 429 | 500 | 502 | 504,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorBody(code: string, message: string) {
  return { error: { code, message } };
}

export function handleError(err: unknown, c: Context) {
  if (err instanceof ApiError) return c.json(errorBody(err.code, err.message), err.status);
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.join(".") || "(本文)";
    return c.json(errorBody("invalid_request", `入力が正しくありません: ${where} ${first?.message ?? ""}`.trim()), 400);
  }
  console.error("[nekase/api] 想定外のエラー", err);
  return c.json(errorBody("internal", "サーバーでエラーが起きました。"), 500);
}
