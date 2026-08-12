import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { createDefaultBoardColumns } from '../domain/defaultBoardColumns.js';

/**
 * GET /api/boards?projectId=xxx
 */
export async function getBoards(req: Request, res: Response): Promise<void> {
  const projectId = req.params.projectId || req.query.projectId;
  const where = projectId ? { projectId: projectId as string } : {};
  const boards = await prisma.board.findMany({
    where,
    include: { columns: { orderBy: { order: 'asc' } }, project: true },
    orderBy: { createdAt: 'asc' },
  });
  const data = boards.map((board) => ({ ...board, title: board.name, type: 'kanban', columns: board.columns.map((column) => ({ ...column, title: column.name, tasks: [] })) }));
  res.json({ success: true, data: req.params.projectId ? { boards: data, total: data.length } : data });
}

/**
 * GET /api/boards/:id
 */
export async function getBoardById(req: Request, res: Response): Promise<void> {
  const board = await prisma.board.findUnique({
    where: { id: req.params.id },
    include: {
      columns: { orderBy: { order: 'asc' } },
      project: true,
      tasks: {
        include: {
          assignee: true,
          sprint: true,
          reporter: true,
          subtasks: { orderBy: { order: 'asc' } },
          comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!board) throw new NotFoundError('Board', req.params.id);
  res.json({ success: true, data: board });
}

/**
 * POST /api/boards
 */
export async function createBoard(req: Request, res: Response): Promise<void> {
  const projectId = req.params.projectId || req.body.projectId;
  const { name, title, description, columns } = req.body;
  const boardName = name || title;
  if (!projectId || !boardName) throw new ValidationError('projectId and title are required');

  const projectExists = await prisma.project.findUnique({ where: { id: projectId } });
  if (!projectExists) throw new NotFoundError('Project', projectId);

  const defaultColumns = columns || createDefaultBoardColumns();

  const board = await prisma.board.create({
    data: {
      projectId,
      name: boardName,
      description: description || '',
      columns: { create: defaultColumns },
    },
    include: { columns: { orderBy: { order: 'asc' } } },
  });

  res.status(201).json({ success: true, data: board });
}

/**
 * PUT /api/boards/:id
 */
export async function updateBoard(req: Request, res: Response): Promise<void> {
  const { name, description, columns } = req.body;
  const boardId = req.params.id;

  const existing = await prisma.board.findUnique({ where: { id: boardId } });
  if (!existing) throw new NotFoundError('Board', boardId);

  // If columns are provided, replace all columns
  if (columns && Array.isArray(columns)) {
    await prisma.$transaction([
      prisma.boardColumn.deleteMany({ where: { boardId } }),
      ...columns.map((col: { name: string; status: string; order: number }, i: number) =>
        prisma.boardColumn.create({
          data: { boardId, name: col.name, status: col.status, order: col.order ?? i },
        })
      ),
    ]);
  }

  const board = await prisma.board.update({
    where: { id: boardId },
    data: { name, description },
    include: { columns: { orderBy: { order: 'asc' } } },
  });
  res.json({ success: true, data: board });
}

/**
 * DELETE /api/boards/:id
 */
export async function deleteBoard(req: Request, res: Response): Promise<void> {
  const board = await prisma.board.findUnique({ where: { id: req.params.id } });
  if (!board) throw new NotFoundError('Board', req.params.id);

  // Reassign tasks from this board to another board in the same project
  const siblingBoards = await prisma.board.findMany({
    where: { projectId: board.projectId, id: { not: board.id } },
  });
  if (siblingBoards.length > 0) {
    await prisma.task.updateMany({
      where: { boardId: board.id },
      data: { boardId: siblingBoards[0].id },
    });
  }

  await prisma.board.delete({ where: { id: board.id } });
  res.json({ success: true, message: 'Board deleted' });
}

/**
 * POST /api/boards/:id/favorite
 */
export async function toggleFavorite(req: Request, res: Response): Promise<void> {
  const existing = await prisma.board.findUnique({
    where: { id: req.params.id },
    select: { id: true, isFavorite: true },
  });
  if (!existing) throw new NotFoundError('Board', req.params.id);

  const board = await prisma.board.update({
    where: { id: existing.id },
    data: { isFavorite: !existing.isFavorite },
    select: { id: true, isFavorite: true },
  });
  res.json({ success: true, data: board });
}
