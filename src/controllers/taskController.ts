import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { generateTaskKey, parseJsonField, stringifyJsonField, nowISO } from '../utils/helpers.js';
import { TaskStatus, TaskType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { recordActivity } from '../utils/recordActivity.js';
import { getPagination, paginated } from '../utils/pagination.js';

// ─────────── Helpers ────────────

const fullInclude = {

  assignee: true,
  reporter: true,
  subtasks: { orderBy: { order: 'asc' } },
  comments: { include: { author: true }, orderBy: { createdAt: 'desc' } },
  project: true,
  sprint: true,
  board: true,
  column: true,
} satisfies Prisma.TaskInclude;

type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof fullInclude }>;

function transformTask(task: TaskWithRelations) {
  return {
    ...task,
    labels: parseJsonField<string[]>(task.labels, []),
  };
}

async function ensureProjectAssignee(projectId: string, assigneeId: string | null | undefined): Promise<void> {
  if (!assigneeId) return;
  const member = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId, userId: assigneeId } } });
  if (!member) throw new ValidationError('Assignee must be a member of this project');
}

// ─────────── Controllers ────────────

/**
 * GET /api/tasks?projectId=xxx&sprintId=xxx&status=xxx&boardId=xxx&assigneeId=xxx&type=xxx
 */
export async function getTasks(req: Request, res: Response): Promise<void> {
  const { projectId, sprintId, status, boardId, assigneeId, type, search } = req.query;

  const where: Prisma.TaskWhereInput = {};
  if (projectId) where.projectId = projectId as string;
  if (sprintId === 'backlog') where.sprintId = null;
  else if (sprintId) where.sprintId = sprintId as string;
  if (status) where.status = status as TaskStatus;
  if (boardId) where.boardId = boardId as string;
  if (assigneeId) where.assigneeId = assigneeId as string;
  if (type) where.type = type as TaskType;
  if (search) {
    where.OR = [
      { title: { contains: search as string } },
      { key: { contains: search as string } },
      { description: { contains: search as string } },
    ];
  }

  const isPaginated = req.query.page !== undefined || req.query.limit !== undefined;
  const pagination = getPagination(req.query);
  const [tasks, totalCount] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      include: fullInclude,
      orderBy: { createdAt: 'asc' },
      skip: isPaginated ? pagination.skip : undefined,
      take: isPaginated ? pagination.limit : undefined,
    }),
    prisma.task.count({ where }),
  ]);
  const data = tasks.map(transformTask);

  res.json({
    success: true,
    data: isPaginated
      ? paginated(data, pagination.page, pagination.limit, totalCount)
      : data,
  });
}

/**
 * GET /api/tasks/:id
 */
export async function getTaskById(req: Request, res: Response): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: fullInclude,
  });
  if (!task) throw new NotFoundError('Task', req.params.id);
  res.json({ success: true, data: transformTask(task) });
}

/**
 * POST /api/tasks
 */
export async function createTask(req: Request, res: Response): Promise<void> {
  const {
    title, description, status, priority, type,
    assigneeId, projectId, sprintId, boardId, columnId,
    loggedTime, estimatedTime, subtasks, comments, labels, dueDate,
  } = req.body;

  if (!title || !projectId) {
    throw new ValidationError('title and projectId are required');
  }

  // Find project key to generate task key
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new NotFoundError('Project', projectId);

  const key = await generateTaskKey(project.key);
  await ensureProjectAssignee(projectId, assigneeId);

  const column = columnId
    ? await prisma.boardColumn.findFirst({
        where: { id: columnId, boardId: boardId || undefined },
      })
    : null;
  if (columnId && !column) throw new NotFoundError('Column', columnId);
  const order = column
    ? await prisma.task.count({ where: { columnId: column.id } })
    : 0;

  const task = await prisma.task.create({
    data: {
      key,
      title,
      description: description || '',
      status: (column?.status || status || 'TODO') as TaskStatus,
      priority: priority || 'MEDIUM',
      type: type || 'TASK',
      assigneeId: assigneeId || null,
      reporterId: req.auth!.id,
      projectId,
      sprintId: sprintId || null,
      boardId: column?.boardId || boardId || null,
      columnId: column?.id || null,
      order,
      loggedTime: loggedTime || 0,
      estimatedTime: estimatedTime || 0,
      labels: stringifyJsonField(labels),
      dueDate: dueDate || null,
      createdAt: nowISO(),
      subtasks: subtasks
        ? { create: subtasks.map((s: { title: string; isDone?: boolean }, i: number) => ({
            title: s.title,
            isDone: s.isDone || false,
            order: i,
          })) }
        : undefined,
      comments: comments
        ? { create: comments.map((c: { content: string; createdAt?: string }) => ({
            authorId: req.auth!.id,
            content: c.content,
            createdAt: c.createdAt || nowISO(),
          })) }
        : undefined,
    },
    include: fullInclude,
  });
  await recordActivity({ projectId, userId: req.auth?.id, action: 'created a task', details: `Created “${task.title}” with ${task.priority.toLowerCase()} priority.`, taskId: task.id, taskKey: task.key });

  res.status(201).json({ success: true, data: transformTask(task) });
}

/**
 * PUT /api/tasks/:id
 */
export async function updateTask(req: Request, res: Response): Promise<void> {
  const taskId = req.params.id;
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError('Task', taskId);

  const {
    title, description, status, priority, type,
    assigneeId, sprintId, boardId, columnId,
    loggedTime, estimatedTime, labels, dueDate,
  } = req.body;

  const data: Prisma.TaskUncheckedUpdateInput = {};
  if (assigneeId !== undefined) await ensureProjectAssignee(existing.projectId, assigneeId);
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (priority !== undefined) data.priority = priority;
  if (type !== undefined) data.type = type;
  if (assigneeId !== undefined) data.assigneeId = assigneeId || null;
  if (sprintId !== undefined) data.sprintId = sprintId || null;
  if (boardId !== undefined) data.boardId = boardId || null;
  if (columnId !== undefined) data.columnId = columnId || null;
  if (loggedTime !== undefined) data.loggedTime = loggedTime;
  if (estimatedTime !== undefined) data.estimatedTime = estimatedTime;
  if (labels !== undefined) data.labels = stringifyJsonField(labels);
  if (dueDate !== undefined) data.dueDate = dueDate || null;

  const task = await prisma.task.update({
    where: { id: taskId },
    data,
    include: fullInclude,
  });
  const changed = Object.keys(data).filter((key) => !['updatedAt'].includes(key));
  await recordActivity({ projectId: existing.projectId, userId: req.auth?.id, action: 'updated a task', details: changed.length ? `Changed ${changed.join(', ')} on “${task.title}”.` : `Updated “${task.title}”.`, taskId: task.id, taskKey: task.key });

  res.json({ success: true, data: transformTask(task) });
}

/**
 * DELETE /api/tasks/:id
 */
export async function deleteTask(req: Request, res: Response): Promise<void> {
  const taskId = req.params.id;
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError('Task', taskId);

  await recordActivity({ projectId: existing.projectId, userId: req.auth?.id, action: 'deleted a task', details: `Deleted “${existing.title}”.`, taskId: existing.id, taskKey: existing.key });
  await prisma.task.delete({ where: { id: taskId } });
  res.json({ success: true, message: 'Task deleted' });
}

/** POST /api/tasks/bulk-sprint - Assign multiple project tasks to a sprint or backlog. */
export async function bulkAssignSprint(req: Request, res: Response): Promise<void> {
  const { taskIds, sprintId, projectId } = req.body;
  if (!projectId || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw new ValidationError('projectId and at least one task id are required');
  }

  if (sprintId) {
    const sprint = await prisma.sprint.findFirst({ where: { id: sprintId, projectId } });
    if (!sprint) throw new NotFoundError('Sprint', sprintId);
  }

  const result = await prisma.task.updateMany({
    where: { id: { in: taskIds }, projectId },
    data: { sprintId: sprintId || null },
  });
  await recordActivity({ projectId, action: sprintId ? 'planned tasks into a sprint' : 'moved tasks to backlog', details: `${result.count} task${result.count === 1 ? '' : 's'} ${sprintId ? 'were assigned to a sprint' : 'were returned to the backlog'}.` });
  res.json({ success: true, data: { updatedCount: result.count } });
}

/**
 * PATCH /api/tasks/:id/move – Move task to new status (and optionally sprint)
 */
export async function moveTask(req: Request, res: Response): Promise<void> {
  const { targetColumnId } = req.body;
  const targetOrder = Number(req.body.targetOrder);
  if (!targetColumnId) throw new ValidationError('targetColumnId is required');
  if (!Number.isInteger(targetOrder)) {
    throw new ValidationError('targetOrder must be an integer');
  }

  const taskId = req.params.id;
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new NotFoundError('Task', taskId);

  const destinationColumn = await prisma.boardColumn.findUnique({
    where: { id: targetColumnId },
  });
  if (!destinationColumn) throw new NotFoundError('Column', targetColumnId);

  const sourceTasks = existing.columnId
    ? await prisma.task.findMany({
        where: { columnId: existing.columnId },
        orderBy: { order: 'asc' },
      })
    : [];
  const destinationTasks = existing.columnId === targetColumnId
    ? sourceTasks
    : await prisma.task.findMany({
        where: { columnId: targetColumnId },
        orderBy: { order: 'asc' },
      });
  const sourceWithoutTask = sourceTasks.filter((task) => task.id !== taskId);
  const reorderedDestination = existing.columnId === targetColumnId
    ? sourceWithoutTask
    : destinationTasks.filter((task) => task.id !== taskId);
  const destinationIndex = Math.max(
    0,
    Math.min(targetOrder, reorderedDestination.length),
  );
  reorderedDestination.splice(destinationIndex, 0, existing);

  const sourceUpdates = existing.columnId === targetColumnId
    ? []
    : sourceWithoutTask.map((task, order) =>
        prisma.task.update({ where: { id: task.id }, data: { order } }),
      );
  const destinationUpdates = reorderedDestination.map((task, order) =>
    prisma.task.update({
      where: { id: task.id },
      data: task.id === taskId
        ? {
            columnId: destinationColumn.id,
            boardId: destinationColumn.boardId,
            status: destinationColumn.status as TaskStatus,
            order,
          }
        : { order },
    }),
  );
  await prisma.$transaction([...sourceUpdates, ...destinationUpdates]);

  const task = await prisma.task.findUniqueOrThrow({
    where: { id: taskId },
    include: fullInclude,
  });
  await recordActivity({ projectId: existing.projectId, userId: req.auth?.id, action: existing.status === task.status ? 'reordered a task' : 'changed task status', details: existing.status === task.status ? `Reordered “${task.title}” on the board.` : `Moved “${task.title}” from ${existing.status.toLowerCase()} to ${task.status.toLowerCase()}.`, taskId: task.id, taskKey: task.key });
  res.json({ success: true, data: transformTask(task) });
}

// ─────────── Subtask endpoints ────────────

/**
 * POST /api/tasks/:taskId/subtasks
 */
export async function addSubtask(req: Request, res: Response): Promise<void> {
  const taskId = req.params.taskId;
  const { title } = req.body;
  if (!title) throw new ValidationError('Subtask title is required');

  // Get count for ordering
  const count = await prisma.subtask.count({ where: { taskId } });

  const subtask = await prisma.subtask.create({
    data: { taskId, title, order: count },
  });
  res.status(201).json({ success: true, data: subtask });
}

/**
 * PATCH /api/tasks/:taskId/subtasks/:subtaskId/toggle
 */
export async function toggleSubtask(req: Request, res: Response): Promise<void> {
  const subtask = await prisma.subtask.findUnique({
    where: { id: req.params.subtaskId },
  });
  if (!subtask) throw new NotFoundError('Subtask', req.params.subtaskId);

  const updated = await prisma.subtask.update({
    where: { id: req.params.subtaskId },
    data: { isDone: !subtask.isDone },
  });
  res.json({ success: true, data: updated });
}

/**
 * DELETE /api/tasks/:taskId/subtasks/:subtaskId
 */
export async function deleteSubtask(req: Request, res: Response): Promise<void> {
  const existing = await prisma.subtask.findUnique({ where: { id: req.params.subtaskId } });
  if (!existing) throw new NotFoundError('Subtask', req.params.subtaskId);

  await prisma.subtask.delete({ where: { id: req.params.subtaskId } });
  res.json({ success: true, message: 'Subtask deleted' });
}

// ─────────── Comment endpoints ────────────

/**
 * POST /api/tasks/:taskId/comments
 */
export async function addComment(req: Request, res: Response): Promise<void> {
  const taskId = req.params.taskId;
  const { content } = req.body;
  if (!content) throw new ValidationError('Comment content is required');

  const taskExists = await prisma.task.findUnique({ where: { id: taskId } });
  if (!taskExists) throw new NotFoundError('Task', taskId);

  const comment = await prisma.comment.create({
    data: { taskId, authorId: req.auth!.id, content, createdAt: nowISO() },
    include: { author: true },
  });

  res.status(201).json({ success: true, data: comment });
}

/**
 * DELETE /api/tasks/:taskId/comments/:commentId
 */
export async function deleteComment(req: Request, res: Response): Promise<void> {
  const existing = await prisma.comment.findUnique({ where: { id: req.params.commentId } });
  if (!existing) throw new NotFoundError('Comment', req.params.commentId);

  await prisma.comment.delete({ where: { id: req.params.commentId } });
  res.json({ success: true, message: 'Comment deleted' });
}

