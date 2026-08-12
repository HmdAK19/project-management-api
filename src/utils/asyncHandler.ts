import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async route handler so that rejected promises / thrown errors
 * are forwarded to Express' error-handling middleware via next(err).
 *
 * In Express 4, throwing inside an async function is NOT automatically caught,
 * so without this wrapper the whole process would crash on any thrown error.
 *
 * Usage:
 *   router.get('/x', asyncHandler(controller.method));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
