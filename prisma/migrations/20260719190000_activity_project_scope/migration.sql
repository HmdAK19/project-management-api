ALTER TABLE "activity_logs" ADD COLUMN "projectId" TEXT REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
UPDATE "activity_logs" SET "projectId" = (SELECT "projectId" FROM "tasks" WHERE "tasks"."id" = "activity_logs"."taskId") WHERE "taskId" IS NOT NULL;
CREATE INDEX "activity_logs_projectId_timestamp_idx" ON "activity_logs"("projectId", "timestamp");
