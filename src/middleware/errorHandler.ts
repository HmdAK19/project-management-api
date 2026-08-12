import type { NextFunction, Request, Response } from "express";
import { ERROR_CODES, type ErrorCode } from "../domain/errors/errorCodes.js";
import type {
  ErrorParams,
  ErrorPayload,
  FieldError,
} from "../domain/errors/types.js";

interface AppErrorOptions {
  code: ErrorCode;
  statusCode: number;
  params?: ErrorParams;
  fields?: FieldError[];
  details?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly params?: ErrorParams;
  readonly fields?: FieldError[];
  readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);
    this.name = new.target.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.params = options.params;
    this.fields = options.fields;
    this.details = options.details;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} with id '${id}' not found`, {
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
      statusCode: 404,
      params: { resource, id },
    });
  }
}

interface ValidationErrorOptions {
  code?: ErrorCode;
  params?: ErrorParams;
  fields?: FieldError[];
  details?: unknown;
}

export class ValidationError extends AppError {
  constructor(message: string, options: ValidationErrorOptions = {}) {
    super(message, {
      code: options.code ?? ERROR_CODES.VALIDATION_FAILED,
      statusCode: 400,
      params: options.params,
      fields: options.fields,
      details: options.details,
    });
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    code: ErrorCode = ERROR_CODES.CONFLICT,
    params?: ErrorParams,
  ) {
    super(message, { code, statusCode: 409, params });
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = "Authentication required",
    code: ErrorCode = ERROR_CODES.AUTHENTICATION_REQUIRED,
    params?: ErrorParams,
  ) {
    super(message, { code, statusCode: 401, params });
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = "Access denied",
    code: ErrorCode = ERROR_CODES.ACCESS_DENIED,
    params?: ErrorParams,
  ) {
    super(message, { code, statusCode: 403, params });
  }
}

const toErrorPayload = (error: Error): ErrorPayload => {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.params && { params: error.params }),
      ...(error.fields?.length && { fields: error.fields }),
      ...(error.details !== undefined && { details: error.details }),
    };
  }

  return {
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: "Internal Server Error",
  };
};

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  void _next;

  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const payload = toErrorPayload(error);
  const timestamp = new Date().toISOString();

  if (statusCode >= 500) {
    console.error(`[${timestamp}] ERROR:`, error);
  } else if (statusCode !== 401) {
    console.warn(`[${timestamp}] ${statusCode}: ${payload.message}`);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      ...payload,
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    },
  });
}
