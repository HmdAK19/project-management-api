import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { nowISO } from '../utils/helpers.js';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/activity?limit=50&taskId=xxx&userId=xxx
 */
export async function getActivityLogs(req: Request, res: Response): Promise<void> {
  const limit = parseInt(req.query.limit as string) || 50;
  const { taskId, userId, projectId, action, before } = req.query;

  const where: Prisma.ActivityLogWhereInput = {};
  if (taskId) where.taskId = taskId as string;
  if (userId) where.userId = userId as string;
  if (projectId) where.projectId = projectId as string;
  if (action) where.action = { contains: action as string };
  if (before) where.timestamp = { lt: new Date(before as string) };

  const logs = await prisma.activityLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, avatar: true, color: true } } },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  res.json({ success: true, data: logs });
}

/**
 * POST /api/activity
 */
export async function createActivityLog(req: Request, res: Response): Promise<void> {
  const { userId, action, details, taskId, taskKey, projectId } = req.body;
  if (!userId || !action) {
    throw new ValidationError('userId and action are required');
  }

  const log = await prisma.activityLog.create({
    data: {
      userId,
      action,
      details: details || '',
      taskId: taskId || null,
      taskKey: taskKey || null,
      projectId: projectId || null,
      timestamp: nowISO(),
    },
    include: { user: { select: { id: true, name: true, avatar: true, color: true } } },
  });

  res.status(201).json({ success: true, data: log });
}

/**
 * DELETE /api/activity/:id
 */
export async function deleteActivityLog(req: Request, res: Response): Promise<void> {
  const existing = await prisma.activityLog.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('ActivityLog', req.params.id);

  await prisma.activityLog.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Activity log deleted' });
}

