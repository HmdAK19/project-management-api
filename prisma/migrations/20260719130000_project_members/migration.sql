CREATE TABLE "project_members" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'MEMBER',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");
CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");
CREATE INDEX "project_members_userId_idx" ON "project_members"("userId");
INSERT INTO "project_members" ("id", "projectId", "userId", "role", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(16))), "id", "leadId", 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "projects";
