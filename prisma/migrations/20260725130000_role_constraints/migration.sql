PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "systemRole" TEXT NOT NULL DEFAULT 'USER'
        CHECK ("systemRole" IN ('USER', 'SYSTEM_ADMIN')),
    "color" TEXT NOT NULL,
    "password" TEXT NOT NULL DEFAULT 'changeme',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_users" (
    "id",
    "name",
    "email",
    "avatar",
    "role",
    "systemRole",
    "color",
    "password",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "name",
    "email",
    "avatar",
    "role",
    "systemRole",
    "color",
    "password",
    "createdAt",
    "updatedAt"
FROM "users";

DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "new_project_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER'
        CHECK ("role" IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "project_members_projectId_fkey"
        FOREIGN KEY ("projectId") REFERENCES "projects" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_members_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users" ("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_project_members" (
    "id",
    "projectId",
    "userId",
    "role",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "projectId",
    "userId",
    "role",
    "createdAt",
    "updatedAt"
FROM "project_members";

DROP TABLE "project_members";
ALTER TABLE "new_project_members" RENAME TO "project_members";
CREATE UNIQUE INDEX "project_members_projectId_userId_key"
    ON "project_members"("projectId", "userId");
CREATE INDEX "project_members_projectId_idx"
    ON "project_members"("projectId");
CREATE INDEX "project_members_userId_idx"
    ON "project_members"("userId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
