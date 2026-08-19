-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_boards" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "boards_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_boards" ("createdAt", "description", "id", "name", "projectId", "updatedAt") SELECT "createdAt", "description", "id", "name", "projectId", "updatedAt" FROM "boards";
DROP TABLE "boards";
ALTER TABLE "new_boards" RENAME TO "boards";
UPDATE "tasks"
SET "columnId" = (
  SELECT "board_columns"."id"
  FROM "board_columns"
  WHERE "board_columns"."boardId" = "tasks"."boardId"
    AND "board_columns"."status" = "tasks"."status"
  LIMIT 1
)
WHERE "columnId" IS NULL;
UPDATE "tasks"
SET "order" = (
  SELECT COUNT(*)
  FROM "tasks" AS "earlier_tasks"
  WHERE "earlier_tasks"."columnId" = "tasks"."columnId"
    AND (
      "earlier_tasks"."createdAt" < "tasks"."createdAt"
      OR (
        "earlier_tasks"."createdAt" = "tasks"."createdAt"
        AND "earlier_tasks"."id" < "tasks"."id"
      )
    )
);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
