import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (process.env.NODE_ENV === 'production') {
  for (const key of ['JWT_SECRET', 'DATABASE_URL', 'CLIENT_ORIGIN']) {
    if (!process.env[key]?.trim()) throw new Error(`${key} is required in production`);
  }
  if (process.env.JWT_SECRET === 'fallback-secret' || process.env.JWT_SECRET === 'replace-with-a-long-random-secret') {
    throw new Error('Set a private JWT_SECRET for production');
  }
  if (process.env.VERCEL && !process.env.DATABASE_URL?.startsWith('postgres')) {
    throw new Error('Vercel requires a persistent PostgreSQL DATABASE_URL');
  }
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret',
  accessTokenTtlSeconds: parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS || '900', 10),
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '30', 10),
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

