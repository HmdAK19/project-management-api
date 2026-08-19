-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_sprints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'FUTURE',
    "startDate" TEXT,
    "endDate" TEXT,
    "goal" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "sprints_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sprints" ("createdAt", "endDate", "goal", "id", "name", "startDate", "status", "updatedAt") SELECT "createdAt", "endDate", "goal", "id", "name", "startDate", "status", "updatedAt" FROM "sprints";
DROP TABLE "sprints";
ALTER TABLE "new_sprints" RENAME TO "sprints";
CREATE INDEX "sprints_projectId_idx" ON "sprints"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
