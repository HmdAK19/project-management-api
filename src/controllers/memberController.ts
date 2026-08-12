import { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { assignableRolesFor, isProjectRole } from "../domain/authorization.js";
import type { ProjectRole } from "../types/authorization.js";
import { recordActivity } from '../utils/recordActivity.js';
import { getPagination, paginated } from '../utils/pagination.js';

const memberInclude = { user: { select: { id: true, name: true, email: true, avatar: true, color: true } } } as const;

export async function getProjectMembers(req: Request, res: Response): Promise<void> {
  const { limit, page, skip } = getPagination(req.query);
  const where = { projectId: req.params.projectId };
  const [members, totalCount] = await prisma.$transaction([
    prisma.projectMember.findMany({ where, include: memberInclude, orderBy: { createdAt: 'asc' }, skip, take: limit }),
    prisma.projectMember.count({ where }),
  ]);
  const taskCounts = await prisma.task.groupBy({ by: ['assigneeId', 'status'], where: { projectId: req.params.projectId, assigneeId: { not: null } }, _count: true });
  const data = members.map((member) => ({ ...member, workload: taskCounts.filter((count) => count.assigneeId === member.userId).reduce((total, count) => total + count._count, 0), completed: taskCounts.filter((count) => count.assigneeId === member.userId && count.status === 'DONE').reduce((total, count) => total + count._count, 0) }));
  res.json({ success: true, data: paginated(data, page, limit, totalCount) });
}

export async function getAvailableProjectUsers(req: Request, res: Response): Promise<void> {
  const users = await prisma.user.findMany({
    where: { projectMemberships: { none: { projectId: req.params.projectId } } },
    select: { id: true, name: true, email: true, avatar: true, color: true },
    orderBy: { name: "asc" },
  });
  res.json({ success: true, data: users });
}

export async function addProjectMember(req: Request, res: Response): Promise<void> {
  const { userId, role = 'MEMBER' } = req.body;
  if (!userId || !isProjectRole(role) || role === "OWNER") throw new ValidationError('A valid user and assignable role are required');
  const actorRole = (await getActorMembership(req.params.projectId, req.auth?.id)).role as ProjectRole;
  if (!assignableRolesFor(actorRole).includes(role)) {
    throw new ForbiddenError("You cannot assign this role");
  }
  const existing = await prisma.projectMember.findUnique({ where: { projectId_userId: { projectId: req.params.projectId, userId } } });
  if (existing) throw new ConflictError('User is already a project member');
  const member = await prisma.projectMember.create({ data: { projectId: req.params.projectId, userId, role }, include: memberInclude });
  await recordActivity({ projectId: req.params.projectId, action: 'added a team member', details: `Added ${member.user.name} as ${role.toLowerCase()}.` });
  res.status(201).json({ success: true, data: { ...member, workload: 0, completed: 0 } });
}

export async function updateProjectMember(req: Request, res: Response): Promise<void> {
  const { role } = req.body;
  if (!isProjectRole(role)) throw new ValidationError('A valid project role is required');
  const member = await prisma.projectMember.findUnique({ where: { id: req.params.memberId } });
  if (!member || member.projectId !== req.params.projectId) throw new NotFoundError('Project member', req.params.memberId);
  const actorRole = (await getActorMembership(member.projectId, req.auth?.id)).role as ProjectRole;
  if (member.role === "OWNER" || role === "OWNER") {
    throw new ForbiddenError("Ownership must be transferred through the dedicated endpoint");
  }
  if (
    !assignableRolesFor(actorRole).includes(member.role as ProjectRole) ||
    !assignableRolesFor(actorRole).includes(role)
  ) {
    throw new ForbiddenError("You cannot assign this role");
  }
  const updated = await prisma.projectMember.update({ where: { id: member.id }, data: { role }, include: memberInclude });
  await recordActivity({ projectId: member.projectId, action: 'changed a member role', details: `Changed ${updated.user.name} to ${role.toLowerCase()}.` });
  res.json({ success: true, data: updated });
}

export async function removeProjectMember(req: Request, res: Response): Promise<void> {
  const member = await prisma.projectMember.findUnique({ where: { id: req.params.memberId } });
  if (!member || member.projectId !== req.params.projectId) throw new NotFoundError('Project member', req.params.memberId);
  if (member.role === 'OWNER') throw new ForbiddenError('The project owner cannot be removed');
  if (member.userId === req.auth?.id) throw new ValidationError('Use leave project to remove your own membership');
  const actor = await getActorMembership(member.projectId, req.auth?.id);
  if (!assignableRolesFor(actor.role as ProjectRole).includes(member.role as ProjectRole)) {
    throw new ForbiddenError("You cannot remove a member with this role");
  }
  await prisma.$transaction([
    prisma.task.updateMany({ where: { projectId: member.projectId, assigneeId: member.userId, status: { not: 'DONE' } }, data: { assigneeId: null } }),
    prisma.projectMember.delete({ where: { id: member.id } }),
  ]);
  await recordActivity({ projectId: member.projectId, action: 'removed a team member', details: 'Removed a member from the project and unassigned their open tasks.' });
  res.status(204).send();
}

export async function leaveProject(req: Request, res: Response): Promise<void> {
  const membership = await getActorMembership(req.params.projectId, req.auth?.id);
  if (membership.role === "OWNER") {
    throw new ForbiddenError(
      "Transfer project ownership before leaving the project",
    );
  }

  await prisma.$transaction([
    prisma.task.updateMany({
      where: {
        projectId: membership.projectId,
        assigneeId: membership.userId,
        status: { not: "DONE" },
      },
      data: { assigneeId: null },
    }),
    prisma.projectMember.delete({ where: { id: membership.id } }),
  ]);
  await recordActivity({
    projectId: membership.projectId,
    userId: membership.userId,
    action: "left the project",
    details: "A team member left the project; their open tasks were unassigned.",
  });
  res.status(204).send();
}

export async function transferProjectOwnership(req: Request, res: Response): Promise<void> {
  const projectId = req.params.projectId;
  const target = await prisma.projectMember.findUnique({ where: { id: req.params.memberId } });
  if (!target || target.projectId !== projectId) throw new NotFoundError("Project member", req.params.memberId);
  const actor = await getActorMembership(projectId, req.auth?.id);
  if (actor.role !== "OWNER") {
    throw new ForbiddenError("Only the project owner can transfer ownership");
  }
  if (target.role === "OWNER") {
    res.json({ success: true, data: target });
    return;
  }
  const updated = await prisma.$transaction(async (tx) => {
    await tx.projectMember.update({ where: { id: actor.id }, data: { role: "ADMIN" } });
    await tx.project.update({ where: { id: projectId }, data: { leadId: target.userId } });
    return tx.projectMember.update({ where: { id: target.id }, data: { role: "OWNER" }, include: memberInclude });
  });
  await recordActivity({ projectId, userId: req.auth?.id, action: "transferred project ownership", details: `Transferred project ownership to ${updated.user.name}.` });
  res.json({ success: true, data: updated });
}

async function getActorMembership(projectId: string, userId?: string) {
  if (!userId) throw new ForbiddenError();
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!membership) throw new ForbiddenError("You are not a member of this project");
  return membership;
}
