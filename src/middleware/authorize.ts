import type { NextFunction, Request, Response } from "express";

import { hasProjectPermission } from "../domain/authorization.js";
import { prisma } from "../config/prisma.js";
import { ForbiddenError, NotFoundError } from "./errorHandler.js";
import type {
  ProjectIdResolver,
  ProjectPermission,
  ProjectRole,
} from "../types/authorization.js";

export const requireProjectPermission =
  (permission: ProjectPermission, resolveProjectId: ProjectIdResolver) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) throw new ForbiddenError();
      const projectId = await resolveProjectId(req);
      if (!projectId) throw new NotFoundError("Project", "unknown");

      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: req.auth.id,
          },
        },
        select: { role: true },
      });
      if (
        !membership ||
        !hasProjectPermission(membership.role as ProjectRole, permission)
      ) {
        throw new ForbiddenError(
          "You do not have permission to perform this action",
        );
      }
      next();
    } catch (error) {
      next(error);
    }
  };

export const projectIdFromParam: ProjectIdResolver = (req) =>
  req.params.projectId;

export const projectIdFromRequest: ProjectIdResolver = (req) =>
  String(req.params.projectId || req.body.projectId || req.query.projectId || "") ||
  undefined;

export const projectIdFromProject: ProjectIdResolver = (req) =>
  req.params.id;

export const projectIdFromBoard: ProjectIdResolver = async (req) =>
  (
    await prisma.board.findUnique({
      where: { id: req.params.id || req.body.boardId },
      select: { projectId: true },
    })
  )?.projectId;

export const projectIdFromTask: ProjectIdResolver = async (req) =>
  req.body.projectId ||
  req.query.projectId ||
  (
    await prisma.task.findUnique({
      where: { id: req.params.id || req.params.taskId },
      select: { projectId: true },
    })
  )?.projectId;

export const projectIdFromSprint: ProjectIdResolver = async (req) =>
  req.body.projectId ||
  req.query.projectId ||
  (
    await prisma.sprint.findUnique({
      where: { id: req.params.id },
      select: { projectId: true },
    })
  )?.projectId ||
  undefined;

export const projectIdFromWiki: ProjectIdResolver = async (req) =>
  req.body.projectId ||
  req.query.projectId ||
  (
    await prisma.wikiPage.findUnique({
      where: { id: req.params.id },
      select: { projectId: true },
    })
  )?.projectId;

export const projectIdFromActivity: ProjectIdResolver = async (req) =>
  req.body.projectId ||
  req.query.projectId ||
  (
    await prisma.activityLog.findUnique({
      where: { id: req.params.id },
      select: { projectId: true },
    })
  )?.projectId ||
  undefined;
