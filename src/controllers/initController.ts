import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

/**
 * GET /api/init
 * Returns all data the frontend needs to initialize the store.
 * This is a single endpoint that provides the complete state snapshot.
 */
export async function initializeStore(req: Request, res: Response): Promise<void> {
  const [tasks, projects, sprints, users, boards, logs] = await Promise.all([
    prisma.task.findMany({
      include: {
        assignee: true,
        reporter: true,
        subtasks: { orderBy: { order: 'asc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.project.findMany({ include: { lead: true }, orderBy: { createdAt: 'asc' } }),
    prisma.sprint.findMany({ orderBy: { startDate: 'asc' } }),
    prisma.user.findMany({ orderBy: { name: 'asc' } }),
    prisma.board.findMany({
      include: { columns: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.activityLog.findMany({
      include: { user: { select: { id: true, name: true, avatar: true, color: true } } },
      orderBy: { timestamp: 'desc' },
      take: 50,
    }),
  ]);

  const transformedTasks = tasks.map((task) => ({
    ...task,
    labels: JSON.parse(task.labels || '[]'),
  }));

  res.json({
    success: true,
    data: {
      tasks: transformedTasks,
      projects,
      sprints,
      users,
      boards,
      logs,
    },
  });
}