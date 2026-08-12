import type { AuthenticatedUser } from "./authorization.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
    }
  }
}

export {};
