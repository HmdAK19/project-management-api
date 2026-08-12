import { prisma } from '../config/prisma.js';

/**
 * Generate a unique task key like "PROJ-101" for a given project.
 * Finds the highest numeric suffix currently used and increments it.
 */
export async function generateTaskKey(projectKey: string): Promise<string> {
  const tasks = await prisma.task.findMany({
    where: { key: { startsWith: `${projectKey}-` } },
    select: { key: true },
  });

  let maxNum = 0;
  for (const t of tasks) {
    const parts = t.key.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num) && num > maxNum) {
      maxNum = num;
    }
  }

  return `${projectKey}-${maxNum + 1}`;
}

/**
 * Parse a JSON string field from SQLite (labels, etc.)
 */
export function parseJsonField<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Safely stringify a value to JSON for SQLite storage
 */
export function stringifyJsonField(value: unknown): string {
  return JSON.stringify(value ?? []);
}

/**
 * Create an ISO timestamp string
 */
export function nowISO(): string {
  return new Date().toISOString();
}
