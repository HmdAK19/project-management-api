import type { Request } from "express";

export const PROJECT_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_PERMISSIONS = [
  "project.read",
  "project.update",
  "project.delete",
  "member.manage",
  "board.manage",
  "sprint.manage",
  "task.manage",
  "document.manage",
  "activity.read",
] as const;
export type ProjectPermission = (typeof PROJECT_PERMISSIONS)[number];

export interface AuthenticatedUser {
  id: string;
}

export type ProjectIdResolver = (
  request: Request,
) => string | undefined | Promise<string | undefined>;
