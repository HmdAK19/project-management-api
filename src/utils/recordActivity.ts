import { prisma } from '../config/prisma.js';

interface ActivityInput { projectId: string; userId?: string | null; action: string; details: string; taskId?: string | null; taskKey?: string | null; }

export async function recordActivity(input: ActivityInput): Promise<void> {
  const fallback = input.userId ? null : await prisma.project.findUnique({ where: { id: input.projectId }, select: { leadId: true } });
  const userId = input.userId || fallback?.leadId;
  if (!userId) return;
  await prisma.activityLog.create({ data: { projectId: input.projectId, userId, action: input.action, details: input.details, taskId: input.taskId || null, taskKey: input.taskKey || null } });
}
