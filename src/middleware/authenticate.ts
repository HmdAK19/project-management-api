import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { config } from "../config/index.js";
import { prisma } from "../config/prisma.js";
import { UnauthorizedError } from "./errorHandler.js";
import { ERROR_CODES } from "../domain/errors/errorCodes.js";

interface AccessTokenPayload {
  sub: string;
  exp: number;
}

const decodeAccessToken = (token: string): AccessTokenPayload => {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    throw new UnauthorizedError(
      "Access token is invalid",
      ERROR_CODES.AUTH_ACCESS_TOKEN_INVALID,
    );
  }

  const expected = createHmac("sha256", config.jwtSecret)
    .update(`${header}.${payload}`)
    .digest();
  const received = Buffer.from(signature, "base64url");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new UnauthorizedError(
      "Access token is invalid",
      ERROR_CODES.AUTH_ACCESS_TOKEN_INVALID,
    );
  }

  let decoded: AccessTokenPayload;
  try {
    decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as AccessTokenPayload;
  } catch {
    throw new UnauthorizedError(
      "Access token is invalid",
      ERROR_CODES.AUTH_ACCESS_TOKEN_INVALID,
    );
  }

  if (!decoded.sub || decoded.exp <= Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedError(
      "Access token has expired",
      ERROR_CODES.AUTH_ACCESS_TOKEN_EXPIRED,
    );
  }
  return decoded;
};

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const [scheme, token] = req.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) throw new UnauthorizedError();

    const payload = decodeAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });
    if (!user) {
      throw new UnauthorizedError(
        "User no longer exists",
        ERROR_CODES.AUTH_USER_NOT_FOUND,
      );
    }

    req.auth = { id: user.id };
    next();
  } catch (error) {
    next(error);
  }
};
