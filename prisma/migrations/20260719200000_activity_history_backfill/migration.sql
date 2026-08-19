INSERT INTO "activity_logs" ("id", "userId", "action", "details", "timestamp", "projectId")
SELECT lower(hex(randomblob(16))), "leadId", 'created the project', 'Created project “' || "name" || '” (' || "key" || ').', "createdAt", "id" FROM "projects";
INSERT INTO "activity_logs" ("id", "userId", "action", "details", "timestamp", "taskId", "taskKey", "projectId")
SELECT lower(hex(randomblob(16))), COALESCE("reporterId", (SELECT "leadId" FROM "projects" WHERE "projects"."id" = "tasks"."projectId")), 'created a task', 'Created “' || "title" || '” with ' || lower("priority") || ' priority.', "createdAt", "id", "key", "projectId" FROM "tasks";
INSERT INTO "activity_logs" ("id", "userId", "action", "details", "timestamp", "projectId")
SELECT lower(hex(randomblob(16))), (SELECT "leadId" FROM "projects" WHERE "projects"."id" = "sprints"."projectId"), 'created a sprint', 'Created sprint “' || "name" || '”.', "createdAt", "projectId" FROM "sprints" WHERE "projectId" IS NOT NULL;
INSERT INTO "activity_logs" ("id", "userId", "action", "details", "timestamp", "projectId")
SELECT lower(hex(randomblob(16))), (SELECT "leadId" FROM "projects" WHERE "projects"."id" = "project_members"."projectId"), 'added a team member', 'Added ' || (SELECT "name" FROM "users" WHERE "users"."id" = "project_members"."userId") || ' as ' || lower("role") || '.', "createdAt", "projectId" FROM "project_members";
