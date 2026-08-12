import type {
  ProjectPermission,
  ProjectRole,
} from "../types/authorization.js";
import { PROJECT_ROLES } from "../types/authorization.js";

const ALL_PROJECT_PERMISSIONS: readonly ProjectPermission[] = [
  "project.read",
  "project.update",
  "project.delete",
  "member.manage",
  "board.manage",
  "sprint.manage",
  "task.manage",
  "document.manage",
  "activity.read",
];

const ROLE_PERMISSIONS: Record<ProjectRole, readonly ProjectPermission[]> = {
  OWNER: ALL_PROJECT_PERMISSIONS,
  ADMIN: ALL_PROJECT_PERMISSIONS.filter(
    (permission) => permission !== "project.delete",
  ),
  MEMBER: [
    "project.read",
    "task.manage",
    "document.manage",
    "activity.read",
  ],
  VIEWER: ["project.read", "activity.read"],
};

export const isProjectRole = (value: unknown): value is ProjectRole =>
  typeof value === "string" &&
  PROJECT_ROLES.some((role) => role === value);

export const hasProjectPermission = (
  role: ProjectRole,
  permission: ProjectPermission,
) => ROLE_PERMISSIONS[role].includes(permission);

export const assignableRolesFor = (role: ProjectRole): ProjectRole[] => {
  if (role === "OWNER") return ["ADMIN", "MEMBER", "VIEWER"];
  if (role === "ADMIN") return ["MEMBER", "VIEWER"];
  return [];
};
