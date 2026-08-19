-- DropIndex
DROP INDEX "board_columns_boardId_status_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "assigneeId" TEXT,
    "reporterId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT,
    "boardId" TEXT,
    "columnId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "loggedTime" REAL NOT NULL DEFAULT 0,
    "estimatedTime" REAL NOT NULL DEFAULT 0,
    "labels" TEXT NOT NULL DEFAULT '[]',
    "dueDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tasks_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "boards" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "board_columns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("assigneeId", "boardId", "createdAt", "description", "dueDate", "estimatedTime", "id", "key", "labels", "loggedTime", "priority", "projectId", "reporterId", "sprintId", "status", "title", "type", "updatedAt") SELECT "assigneeId", "boardId", "createdAt", "description", "dueDate", "estimatedTime", "id", "key", "labels", "loggedTime", "priority", "projectId", "reporterId", "sprintId", "status", "title", "type", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE UNIQUE INDEX "tasks_key_key" ON "tasks"("key");
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX "tasks_status_idx" ON "tasks"("status");
CREATE INDEX "tasks_sprintId_idx" ON "tasks"("sprintId");
CREATE INDEX "tasks_boardId_idx" ON "tasks"("boardId");
CREATE INDEX "tasks_columnId_idx" ON "tasks"("columnId");
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "board_columns_boardId_idx" ON "board_columns"("boardId");
