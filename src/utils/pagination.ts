import type { Request } from "express";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const positiveInteger = (
  value: unknown,
  fallback: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const getPagination = (query: Request["query"]) => {
  const page = positiveInteger(query.page, DEFAULT_PAGE);
  const limit = Math.min(
    positiveInteger(query.limit, DEFAULT_LIMIT),
    MAX_LIMIT,
  );

  return {
    limit,
    page,
    skip: (page - 1) * limit,
  };
};

export const paginated = <T>(
  data: T[],
  page: number,
  limit: number,
  totalCount: number,
) => ({
  data,
  hasNextPage: page * limit < totalCount,
  limit,
  page,
  totalCount,
});
