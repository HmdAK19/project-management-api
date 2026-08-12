import { Router } from "express";
import * as activityController from "../controllers/activityController.js";
import * as authController from "../controllers/authController.js";
import * as boardController from "../controllers/boardController.js";
import * as columnController from "../controllers/columnController.js";
import * as memberController from "../controllers/memberController.js";
import * as projectController from "../controllers/projectController.js";
import * as sprintController from "../controllers/sprintController.js";
import * as taskController from "../controllers/taskController.js";
import * as wikiController from "../controllers/wikiController.js";
import {
  projectIdFromActivity,
  projectIdFromBoard,
  projectIdFromParam,
  projectIdFromProject,
  projectIdFromRequest,
  projectIdFromSprint,
  projectIdFromTask,
  projectIdFromWiki,
  requireProjectPermission,
} from "../middleware/authorize.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/api/auth/login", asyncHandler(authController.login));
router.post("/api/auth/register", asyncHandler(authController.register));
router.post("/api/auth/refresh", asyncHandler(authController.refresh));
router.post("/api/auth/logout", asyncHandler(authController.logout));
router.use(authenticate);

router.get("/api/projects", asyncHandler(projectController.getAllProjects));
router.post("/api/projects", asyncHandler(projectController.createProject));
router.get("/api/projects/:id", requireProjectPermission("project.read", projectIdFromProject), asyncHandler(projectController.getProjectById));
router.put("/api/projects/:id", requireProjectPermission("project.update", projectIdFromProject), asyncHandler(projectController.updateProject));
router.delete("/api/projects/:id", requireProjectPermission("project.delete", projectIdFromProject), asyncHandler(projectController.deleteProject));

router.get("/api/projects/:projectId/members", requireProjectPermission("project.read", projectIdFromParam), asyncHandler(memberController.getProjectMembers));
router.get("/api/projects/:projectId/members/available", requireProjectPermission("member.manage", projectIdFromParam), asyncHandler(memberController.getAvailableProjectUsers));
router.post("/api/projects/:projectId/members", requireProjectPermission("member.manage", projectIdFromParam), asyncHandler(memberController.addProjectMember));
router.delete("/api/projects/:projectId/members/me", requireProjectPermission("project.read", projectIdFromParam), asyncHandler(memberController.leaveProject));
router.patch("/api/projects/:projectId/members/:memberId", requireProjectPermission("member.manage", projectIdFromParam), asyncHandler(memberController.updateProjectMember));
router.delete("/api/projects/:projectId/members/:memberId", requireProjectPermission("member.manage", projectIdFromParam), asyncHandler(memberController.removeProjectMember));
router.post("/api/projects/:projectId/members/:memberId/transfer-ownership", requireProjectPermission("project.delete", projectIdFromParam), asyncHandler(memberController.transferProjectOwnership));

router.get("/api/projects/:projectId/boards", requireProjectPermission("project.read", projectIdFromParam), asyncHandler(boardController.getBoards));
router.post("/api/projects/:projectId/boards", requireProjectPermission("board.manage", projectIdFromParam), asyncHandler(boardController.createBoard));
router.get("/api/boards", requireProjectPermission("project.read", projectIdFromRequest), asyncHandler(boardController.getBoards));
router.post("/api/boards", requireProjectPermission("board.manage", projectIdFromRequest), asyncHandler(boardController.createBoard));
router.get("/api/boards/:id", requireProjectPermission("project.read", projectIdFromBoard), asyncHandler(boardController.getBoardById));
router.put("/api/boards/:id", requireProjectPermission("board.manage", projectIdFromBoard), asyncHandler(boardController.updateBoard));
router.delete("/api/boards/:id", requireProjectPermission("board.manage", projectIdFromBoard), asyncHandler(boardController.deleteBoard));
router.post("/api/boards/:id/favorite", requireProjectPermission("board.manage", projectIdFromBoard), asyncHandler(boardController.toggleFavorite));

router.get("/api/projects/:projectId/boards/:boardId/columns", requireProjectPermission("project.read", projectIdFromParam), asyncHandler(columnController.getColumns));
router.post("/api/projects/:projectId/boards/:boardId/columns", requireProjectPermission("board.manage", projectIdFromParam), asyncHandler(columnController.createColumn));
router.patch("/api/projects/:projectId/boards/:boardId/columns/:columnId", requireProjectPermission("board.manage", projectIdFromParam), asyncHandler(columnController.updateColumn));
router.delete("/api/projects/:projectId/boards/:boardId/columns/:columnId", requireProjectPermission("board.manage", projectIdFromParam), asyncHandler(columnController.deleteColumn));
router.post("/api/projects/:projectId/boards/:boardId/columns/:columnId/move", requireProjectPermission("board.manage", projectIdFromParam), asyncHandler(columnController.moveColumn));

router.get("/api/tasks", requireProjectPermission("project.read", projectIdFromTask), asyncHandler(taskController.getTasks));
router.post("/api/tasks/bulk-sprint", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.bulkAssignSprint));
router.get("/api/tasks/:id", requireProjectPermission("project.read", projectIdFromTask), asyncHandler(taskController.getTaskById));
router.post("/api/tasks", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.createTask));
router.put("/api/tasks/:id", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.updateTask));
router.delete("/api/tasks/:id", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.deleteTask));
router.patch("/api/tasks/:id/move", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.moveTask));
router.post("/api/tasks/:taskId/subtasks", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.addSubtask));
router.patch("/api/tasks/:taskId/subtasks/:subtaskId/toggle", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.toggleSubtask));
router.delete("/api/tasks/:taskId/subtasks/:subtaskId", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.deleteSubtask));
router.post("/api/tasks/:taskId/comments", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.addComment));
router.delete("/api/tasks/:taskId/comments/:commentId", requireProjectPermission("task.manage", projectIdFromTask), asyncHandler(taskController.deleteComment));

router.get("/api/sprints", requireProjectPermission("project.read", projectIdFromSprint), asyncHandler(sprintController.getAllSprints));
router.get("/api/sprints/:id", requireProjectPermission("project.read", projectIdFromSprint), asyncHandler(sprintController.getSprintById));
router.post("/api/sprints", requireProjectPermission("sprint.manage", projectIdFromSprint), asyncHandler(sprintController.createSprint));
router.put("/api/sprints/:id", requireProjectPermission("sprint.manage", projectIdFromSprint), asyncHandler(sprintController.updateSprint));
router.patch("/api/sprints/:id/status", requireProjectPermission("sprint.manage", projectIdFromSprint), asyncHandler(sprintController.updateSprintStatus));
router.post("/api/sprints/:id/complete", requireProjectPermission("sprint.manage", projectIdFromSprint), asyncHandler(sprintController.completeSprint));
router.delete("/api/sprints/:id", requireProjectPermission("sprint.manage", projectIdFromSprint), asyncHandler(sprintController.deleteSprint));

router.get("/api/activity", requireProjectPermission("activity.read", projectIdFromActivity), asyncHandler(activityController.getActivityLogs));
router.post("/api/activity", requireProjectPermission("task.manage", projectIdFromActivity), asyncHandler(activityController.createActivityLog));
router.delete("/api/activity/:id", requireProjectPermission("project.update", projectIdFromActivity), asyncHandler(activityController.deleteActivityLog));

router.get("/api/wiki", requireProjectPermission("project.read", projectIdFromWiki), asyncHandler(wikiController.getWikiPages));
router.get("/api/wiki/:id", requireProjectPermission("project.read", projectIdFromWiki), asyncHandler(wikiController.getWikiPageById));
router.post("/api/wiki", requireProjectPermission("document.manage", projectIdFromWiki), asyncHandler(wikiController.createWikiPage));
router.put("/api/wiki/:id", requireProjectPermission("document.manage", projectIdFromWiki), asyncHandler(wikiController.updateWikiPage));
router.delete("/api/wiki/:id", requireProjectPermission("document.manage", projectIdFromWiki), asyncHandler(wikiController.deleteWikiPage));

export default router;
