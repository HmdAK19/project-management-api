import type { ErrorCode } from "./errorCodes.js";

export type ErrorParams = Record<string, string | number | boolean>;

export interface FieldError {
  field: string;
  code: ErrorCode;
  params?: ErrorParams;
}

export interface ErrorPayload {
  code: ErrorCode;
  message: string;
  params?: ErrorParams;
  fields?: FieldError[];
  details?: unknown;
}

