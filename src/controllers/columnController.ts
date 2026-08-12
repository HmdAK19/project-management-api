import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const getBoard = async (projectId: string, boardId: string) => {
  const board = await prisma.board.findFirst({
    where: { id: boardId, projectId },
  });
  if (!board) throw new NotFoundError('Board', boardId);
  return board;
};

export async function getColumns(req: Request, res: Response): Promise<void> {
  await getBoard(req.params.projectId, req.params.boardId);
  const columns = await prisma.boardColumn.findMany({
    where: { boardId: req.params.boardId },
    include: { tasks: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  });
  res.json({ success: true, data: columns });
}

export async function createColumn(req: Request, res: Response): Promise<void> {
  const { projectId, boardId } = req.params;
  await getBoard(projectId, boardId);
  const title = String(req.body.title || req.body.name || '').trim();
  if (!title) throw new ValidationError('Column title is required');

  const order = await prisma.boardColumn.count({ where: { boardId } });
  const column = await prisma.boardColumn.create({
    data: { boardId, name: title, status: 'TODO', order },
  });
  res.status(201).json({ success: true, data: column });
}

export async function updateColumn(req: Request, res: Response): Promise<void> {
  const { projectId, boardId, columnId } = req.params;
  await getBoard(projectId, boardId);
  const existing = await prisma.boardColumn.findFirst({
    where: { id: columnId, boardId },
  });
  if (!existing) throw new NotFoundError('Column', columnId);

  const title = String(req.body.title || req.body.name || '').trim();
  if (!title) throw new ValidationError('Column title is required');
  const column = await prisma.boardColumn.update({
    where: { id: columnId },
    data: { name: title },
  });
  res.json({ success: true, data: column });
}

export async function deleteColumn(req: Request, res: Response): Promise<void> {
  const { projectId, boardId, columnId } = req.params;
  await getBoard(projectId, boardId);
  const existing = await prisma.boardColumn.findFirst({
    where: { id: columnId, boardId },
  });
  if (!existing) throw new NotFoundError('Column', columnId);

  await prisma.$transaction(async (transaction) => {
    await transaction.boardColumn.delete({ where: { id: columnId } });
    const remaining = await transaction.boardColumn.findMany({
      where: { boardId },
      orderBy: { order: 'asc' },
    });
    await Promise.all(remaining.map((column, order) =>
      transaction.boardColumn.update({
        where: { id: column.id },
        data: { order },
      }),
    ));
  });
  res.json({ success: true, message: 'Column deleted' });
}

export async function moveColumn(req: Request, res: Response): Promise<void> {
  const { projectId, boardId, columnId } = req.params;
  await getBoard(projectId, boardId);
  const columns = await prisma.boardColumn.findMany({
    where: { boardId },
    orderBy: { order: 'asc' },
  });
  const sourceIndex = columns.findIndex((column) => column.id === columnId);
  if (sourceIndex < 0) throw new NotFoundError('Column', columnId);

  const requestedOrder = Number(req.body.order);
  if (!Number.isInteger(requestedOrder)) {
    throw new ValidationError('Column order must be an integer');
  }
  const destinationIndex = Math.max(0, Math.min(requestedOrder, columns.length - 1));
  const [moved] = columns.splice(sourceIndex, 1);
  columns.splice(destinationIndex, 0, moved);

  await prisma.$transaction(columns.map((column, order) =>
    prisma.boardColumn.update({ where: { id: column.id }, data: { order } }),
  ));
  res.json({ success: true, data: columns });
}
