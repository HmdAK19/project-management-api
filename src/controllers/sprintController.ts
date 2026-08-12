import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { SprintStatus, type Prisma } from '@prisma/client';
import { recordActivity } from '../utils/recordActivity.js';

/**
 * GET /api/sprints
 */
export async function getAllSprints(req: Request, res: Response): Promise<void> {
  const { projectId } = req.query;
  const where: Prisma.SprintWhereInput = {};
  if (projectId) {
    where.OR = [
      { projectId: projectId as string },
      { projectId: null, tasks: { some: { projectId: projectId as string } } },
    ];
  }

  const sprints = await prisma.sprint.findMany({
    where,
    include: {
      tasks: {
        include: {
          assignee: true,
          reporter: true,
          subtasks: true,
          comments: true,
          project: true,
        },
      },
    },
    orderBy: { startDate: 'asc' },
  });

  res.json({ success: true, data: sprints });
}

/**
 * GET /api/sprints/:id
 */
export async function getSprintById(req: Request, res: Response): Promise<void> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: {
        include: {
          assignee: true,
          reporter: true,
          subtasks: { orderBy: { order: 'asc' } },
          comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
          project: true,
        },
      },
    },
  });
  if (!sprint) throw new NotFoundError('Sprint', req.params.id);
  res.json({ success: true, data: sprint });
}

/**
 * POST /api/sprints
 */
export async function createSprint(req: Request, res: Response): Promise<void> {
  const { projectId, name, status, startDate, endDate, goal } = req.body;
  if (!name || !projectId) {
    throw new ValidationError('Sprint name and projectId are required');
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project', projectId);

  const sprint = await prisma.sprint.create({
    data: {
      name,
      projectId,
      status: status || 'FUTURE',
      startDate: startDate || null,
      endDate: endDate || null,
      goal: goal || null,
    },
  });

  await recordActivity({ projectId, action: 'created a sprint', details: `Created sprint “${sprint.name}”.` });
  res.status(201).json({ success: true, data: sprint });
}

/**
 * PUT /api/sprints/:id
 */
export async function updateSprint(req: Request, res: Response): Promise<void> {
  const { name, status, startDate, endDate, goal } = req.body;
  const existing = await prisma.sprint.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Sprint', req.params.id);

  const sprint = await prisma.sprint.update({
    where: { id: req.params.id },
    data: { name, status, startDate, endDate, goal },
  });
  if (sprint.projectId) await recordActivity({ projectId: sprint.projectId, action: 'updated a sprint', details: `Updated sprint “${sprint.name}”.` });
  res.json({ success: true, data: sprint });
}

/**
 * PATCH /api/sprints/:id/status
 */
export async function updateSprintStatus(req: Request, res: Response): Promise<void> {
  const { status } = req.body;
  if (!status) throw new ValidationError('Status is required');

  const existing = await prisma.sprint.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Sprint', req.params.id);

  const normalizedStatus = String(status).toUpperCase();
  if (!Object.values(SprintStatus).includes(normalizedStatus as SprintStatus)) {
    throw new ValidationError('Invalid sprint status');
  }
  const sprint = await prisma.$transaction(async (transaction) => {
    if (normalizedStatus === 'ACTIVE' && existing.projectId) {
      await transaction.sprint.updateMany({
        where: {
          projectId: existing.projectId,
          status: 'ACTIVE',
          id: { not: existing.id },
        },
        data: { status: 'FUTURE' },
      });
    }

    return transaction.sprint.update({
      where: { id: req.params.id },
      data: { status: normalizedStatus as SprintStatus },
    });
  });
  if (sprint.projectId) await recordActivity({ projectId: sprint.projectId, action: normalizedStatus === 'ACTIVE' ? 'started a sprint' : 'changed sprint status', details: `Changed “${sprint.name}” to ${normalizedStatus.toLowerCase()}.` });
  res.json({ success: true, data: sprint });
}

/**
 * POST /api/sprints/:id/complete
 * Moves unfinished tasks to another sprint (or unassigns them).
 */
export async function completeSprint(req: Request, res: Response): Promise<void> {
  const { moveToSprintId } = req.body;
  const sprintId = req.params.id;

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw new NotFoundError('Sprint', sprintId);

  // Mark sprint as completed
  await prisma.sprint.update({
    where: { id: sprintId },
    data: { status: 'COMPLETED' },
  });

  // Move unfinished tasks
  if (moveToSprintId) {
    await prisma.task.updateMany({
      where: { sprintId, status: { not: 'DONE' } },
      data: { sprintId: moveToSprintId },
    });
  } else {
    await prisma.task.updateMany({
      where: { sprintId, status: { not: 'DONE' } },
      data: { sprintId: null },
    });
  }

  const updatedSprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { tasks: true },
  });
  if (sprint.projectId) await recordActivity({ projectId: sprint.projectId, action: 'completed a sprint', details: `Completed sprint “${sprint.name}” and handled unfinished work.` });

  res.json({ success: true, data: updatedSprint });
}

/**
 * DELETE /api/sprints/:id
 */
export async function deleteSprint(req: Request, res: Response): Promise<void> {
  const sprintId = req.params.id;
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw new NotFoundError('Sprint', sprintId);

  // Unassign tasks from this sprint
  await prisma.task.updateMany({
    where: { sprintId },
    data: { sprintId: null },
  });

  await prisma.sprint.delete({ where: { id: sprintId } });
  if (sprint.projectId) await recordActivity({ projectId: sprint.projectId, action: 'deleted a sprint', details: `Deleted sprint “${sprint.name}”.` });
  res.json({ success: true, message: 'Sprint deleted' });
}
