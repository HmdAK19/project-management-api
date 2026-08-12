import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/errorHandler.js';
import { recordActivity } from '../utils/recordActivity.js';
import { getPagination, paginated } from '../utils/pagination.js';
import { createDefaultBoardColumns } from '../domain/defaultBoardColumns.js';

/**
 * GET /api/projects
 */
export async function getAllProjects(req: Request, res: Response): Promise<void> {
  const { limit, page, skip } = getPagination(req.query);
  const where = { members: { some: { userId: req.auth?.id } } };
  const [projects, totalCount] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      include: {
        lead: true,
        members: { include: { user: { select: { id: true, name: true, email: true, avatar: true, color: true } } }, orderBy: { createdAt: 'asc' } },
        tasks: { select: { status: true, assigneeId: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);
  const data = projects.map(({ tasks, ...project }) => ({
    ...project,
    stats: {
      totalTasks: tasks.length,
      openTasks: tasks.filter((task) => task.status !== 'DONE').length,
      unassignedTasks: tasks.filter((task) => task.status !== 'DONE' && !task.assigneeId).length,
    },
  }));
  res.json({ success: true, data: paginated(data, page, limit, totalCount) });
}

/**
 * GET /api/projects/:id
 */
export async function getProjectById(req: Request, res: Response): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: { lead: true, boards: { include: { columns: { orderBy: { order: 'asc' } } } } },
  });
  if (!project) throw new NotFoundError('Project', req.params.id);
  res.json({ success: true, data: project });
}

/**
 * POST /api/projects
 * Also creates a default board with the standard workflow columns.
 */
export async function createProject(req: Request, res: Response): Promise<void> {
  const { name, key, category, description, rgb } = req.body;
  if (!name || !key) throw new ValidationError('Project name and key are required');

  const existing = await prisma.project.findUnique({ where: { key } });
  if (existing) throw new ConflictError(`Project key '${key}' already exists`);

  const defaultLead = req.auth?.id;
  if (!defaultLead) throw new ValidationError('Create a user before creating a project');
  const boardId = `b-${Date.now()}`;
  const project = await prisma.project.create({
    data: {
      name,
      key,
      leadId: defaultLead,
      category: category || '',
      description: description || '',
      rgb: rgb || '#0052CC',
      members: { create: { userId: defaultLead, role: 'OWNER' } },
      boards: {
        create: {
          id: boardId,
          name: `${name} Board`,
          description: `Default board for ${name}`,
          columns: {
            create: createDefaultBoardColumns(),
          },
        },
      },
    },
    include: { lead: true, boards: { include: { columns: { orderBy: { order: 'asc' } } } } },
  });

  await recordActivity({ projectId: project.id, userId: defaultLead, action: 'created the project', details: `Created project “${project.name}” (${project.key}).` });
  res.status(201).json({ success: true, data: project });
}

/**
 * PUT /api/projects/:id
 */
export async function updateProject(req: Request, res: Response): Promise<void> {
  const { name, key, category, description, rgb } = req.body;
  const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new NotFoundError('Project', req.params.id);

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: { name, key, category, description, rgb },
    include: { lead: true },
  });
  await recordActivity({ projectId: project.id, userId: req.auth?.id, action: 'updated project settings', details: `Updated project “${project.name}”.` });
  res.json({ success: true, data: project });
}

/**
 * DELETE /api/projects/:id
 * Cascades to delete boards, columns, and tasks.
 */
export async function deleteProject(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundError('Project', id);

  await prisma.project.delete({ where: { id } });
  res.json({ success: true, message: 'Project and all related data deleted' });
}
