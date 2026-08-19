-- Preserve backlog tasks as unassigned planning items before removing the
-- obsolete workflow columns. Backlog continues to be represented by
-- sprintId = NULL, independently from board workflow.
UPDATE "tasks"
SET "columnId" = NULL
WHERE "columnId" IN (
  SELECT "id"
  FROM "board_columns"
  WHERE "status" = 'BACKLOG'
);

DELETE FROM "board_columns"
WHERE "status" = 'BACKLOG';
