import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import type { Prisma } from '@prisma/client';
import { getPagination, paginated } from '../utils/pagination.js';

const DOCUMENT_TYPES = new Set(['WIKI', 'SPEC', 'MEETING_NOTE', 'DECISION', 'GENERAL']);
const DOCUMENT_STATUSES = new Set(['DRAFT', 'PUBLISHED']);

function normalizeSlug(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'document';
}

async function uniqueSlug(projectId: string, value: string, excludeId?: string): Promise<string> {
  const base = normalizeSlug(value);
  let slug = base;
  let suffix = 2;
  while (await prisma.wikiPage.findFirst({ where: { projectId, slug, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } })) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

function validateMetadata(type?: string, status?: string): void {
  if (type && !DOCUMENT_TYPES.has(type)) throw new ValidationError('Invalid document type');
  if (status && !DOCUMENT_STATUSES.has(status)) throw new ValidationError('Invalid document status');
}

/**
 * GET /api/wiki?projectId=xxx
 */
export async function getWikiPages(req: Request, res: Response): Promise<void> {
  const { projectId } = req.query;
  const { limit, page, skip } = getPagination(req.query);
  const where: Prisma.WikiPageWhereInput = {};
  if (projectId) where.projectId = projectId as string;

  const [pages, totalCount] = await prisma.$transaction([
    prisma.wikiPage.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.wikiPage.count({ where }),
  ]);

  res.json({
    success: true,
    data: paginated(pages, page, limit, totalCount),
  });
}

/**
 * GET /api/wiki/:id
 */
export async function getWikiPageById(req: Request, res: Response): Promise<void> {
  const page = await prisma.wikiPage.findUnique({ where: { id: req.params.id } });
  if (!page) throw new NotFoundError('WikiPage', req.params.id);
  res.json({ success: true, data: page });
}

/**
 * POST /api/wiki
 */
export async function createWikiPage(req: Request, res: Response): Promise<void> {
  const { projectId, title, content, slug, type, status } = req.body;
  if (!projectId || !title) throw new ValidationError('projectId and title are required');
  validateMetadata(type, status);

  const pageSlug = await uniqueSlug(projectId, slug || title);

  const page = await prisma.wikiPage.create({
    data: {
      projectId,
      title,
      content: content || '',
      slug: pageSlug,
      type: type || 'WIKI',
      status: status || 'PUBLISHED',
    },
  });

  res.status(201).json({ success: true, data: page });
}

/**
 * PUT /api/wiki/:id
 */
export async function updateWikiPage(req: Request, res: Response): Promise<void> {
  const { title, content, slug, type, status } = req.body;
  const existing = await prisma.wikiPage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('WikiPage', req.params.id);
  validateMetadata(type, status);
  const nextSlug = slug || (title && title !== existing.title ? await uniqueSlug(existing.projectId, title, existing.id) : undefined);

  const page = await prisma.wikiPage.update({
    where: { id: req.params.id },
    data: { title, content, slug: nextSlug, type, status },
  });
  res.json({ success: true, data: page });
}

/**
 * DELETE /api/wiki/:id
 */
export async function deleteWikiPage(req: Request, res: Response): Promise<void> {
  const existing = await prisma.wikiPage.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('WikiPage', req.params.id);

  await prisma.wikiPage.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Wiki page deleted' });
}

