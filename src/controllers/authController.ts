import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma.js';
import { config } from '../config/index.js';
import {
  ConflictError,
  UnauthorizedError,
  ValidationError,
} from '../middleware/errorHandler.js';
import { ERROR_CODES } from '../domain/errors/errorCodes.js';

const REFRESH_COOKIE = 'refreshToken';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  role: true,
  color: true,
  createdAt: true,
  updatedAt: true,
} as const;

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function signAccessToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    sub: userId,
    iat: now,
    exp: now + config.accessTokenTtlSeconds,
  }));
  const signature = createHmac('sha256', config.jwtSecret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(req: Request, name: string): string | undefined {
  const prefix = `${name}=`;
  const cookie = req.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  if (!cookie) return undefined;

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return undefined;
  }
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

async function createRefreshToken(userId: string) {
  const token = randomBytes(48).toString('base64url');
  const record = await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(
        Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000
      ),
    },
  });

  return { token, record };
}

function sendAuthResponse(
  res: Response,
  user: Record<string, unknown>,
  message: string
): void {
  res.json({
    success: true,
    message,
    accessToken: signAccessToken(String(user.id)),
    user,
  });
}

/**
 * POST /api/auth/login
 */
export async function login(req: Request, res: Response): Promise<void> {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    throw new ValidationError('Email and password are required', {
      fields: [
        ...(!email
          ? [{ field: 'email', code: ERROR_CODES.AUTH_EMAIL_REQUIRED }]
          : []),
        ...(!password
          ? [{ field: 'password', code: ERROR_CODES.AUTH_PASSWORD_REQUIRED }]
          : []),
      ],
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new UnauthorizedError(
      'Invalid email or password',
      ERROR_CODES.AUTH_INVALID_CREDENTIALS,
    );
  }

  const { token } = await createRefreshToken(user.id);
  setRefreshCookie(res, token);

  const publicUser: Partial<typeof user> = { ...user };
  delete publicUser.password;
  sendAuthResponse(res, publicUser, 'Login successful');
}

/**
 * POST /api/auth/register
 */
export async function register(req: Request, res: Response): Promise<void> {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const confirmPassword = String(req.body.confirmPassword || '');

  if (!name || !email || !password) {
    throw new ValidationError('Name, email and password are required', {
      fields: [
        ...(!name
          ? [{ field: 'name', code: ERROR_CODES.AUTH_NAME_REQUIRED }]
          : []),
        ...(!email
          ? [{ field: 'email', code: ERROR_CODES.AUTH_EMAIL_REQUIRED }]
          : []),
        ...(!password
          ? [{ field: 'password', code: ERROR_CODES.AUTH_PASSWORD_REQUIRED }]
          : []),
      ],
    });
  }
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters', {
      code: ERROR_CODES.AUTH_PASSWORD_TOO_SHORT,
      params: { min: 8 },
      fields: [
        {
          field: 'password',
          code: ERROR_CODES.AUTH_PASSWORD_TOO_SHORT,
          params: { min: 8 },
        },
      ],
    });
  }
  if (password !== confirmPassword) {
    throw new ValidationError('Password confirmation does not match', {
      code: ERROR_CODES.AUTH_PASSWORD_CONFIRMATION_MISMATCH,
      fields: [
        {
          field: 'confirmPassword',
          code: ERROR_CODES.AUTH_PASSWORD_CONFIRMATION_MISMATCH,
        },
      ],
    });
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new ConflictError(
      'User with this email already exists',
      ERROR_CODES.AUTH_EMAIL_ALREADY_EXISTS,
    );
  }

  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      avatar: initials || 'U',
      role: 'Team Member',
      color: '#0052CC',
    },
    select: publicUserSelect,
  });

  const { token } = await createRefreshToken(user.id);
  setRefreshCookie(res, token);
  sendAuthResponse(res.status(201), user, 'Registration successful');
}

/**
 * POST /api/auth/refresh
 * Rotates the refresh token and invalidates the previous token.
 */
export async function refresh(req: Request, res: Response): Promise<void> {
  const rawToken = readCookie(req, REFRESH_COOKIE);
  if (!rawToken) {
    // Session restoration runs on every app startup. A missing cookie there
    // means the visitor is anonymous, not that an authenticated request failed.
    if (req.query.optional === 'true') {
      res.status(204).send();
      return;
    }
    throw new UnauthorizedError(
      'Refresh token is missing',
      ERROR_CODES.AUTH_REFRESH_TOKEN_MISSING,
    );
  }

  const tokenHash = hashToken(rawToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { select: publicUserSelect } },
  });

  if (!storedToken) {
    clearRefreshCookie(res);
    throw new UnauthorizedError(
      'Refresh token is invalid',
      ERROR_CODES.AUTH_REFRESH_TOKEN_INVALID,
    );
  }

  if (storedToken.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: storedToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    throw new UnauthorizedError(
      'Refresh token reuse detected',
      ERROR_CODES.AUTH_REFRESH_TOKEN_REUSED,
    );
  }

  if (storedToken.expiresAt <= new Date()) {
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });
    clearRefreshCookie(res);
    throw new UnauthorizedError(
      'Refresh token has expired',
      ERROR_CODES.AUTH_REFRESH_TOKEN_EXPIRED,
    );
  }

  const nextToken = randomBytes(48).toString('base64url');
  const nextHash = hashToken(nextToken);
  const nextExpiresAt = new Date(
    Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  );

  await prisma.$transaction(async (tx) => {
    const replacement = await tx.refreshToken.create({
      data: {
        tokenHash: nextHash,
        userId: storedToken.userId,
        expiresAt: nextExpiresAt,
      },
    });
    await tx.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: replacement.id,
      },
    });
  });

  setRefreshCookie(res, nextToken);
  sendAuthResponse(res, storedToken.user, 'Token refreshed');
}

/**
 * POST /api/auth/logout
 */
export async function logout(req: Request, res: Response): Promise<void> {
  const rawToken = readCookie(req, REFRESH_COOKIE);

  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  clearRefreshCookie(res);
  res.json({ success: true, message: 'Logout successful' });
}

