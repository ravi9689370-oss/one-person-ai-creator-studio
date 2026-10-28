-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payment_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT,
    "orderId" TEXT,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_payment_events" ("error", "id", "orderId", "payload", "processed", "provider", "receivedAt", "signatureVerified", "type", "workspaceId") SELECT "error", "id", "orderId", "payload", "processed", "provider", "receivedAt", "signatureVerified", "type", "workspaceId" FROM "payment_events";
DROP TABLE "payment_events";
ALTER TABLE "new_payment_events" RENAME TO "payment_events";
CREATE INDEX "payment_events_workspaceId_idx" ON "payment_events"("workspaceId");
CREATE TABLE "new_scripts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "topicId" TEXT,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'long_form',
    "platform" TEXT NOT NULL DEFAULT 'youtube',
    "language" TEXT NOT NULL DEFAULT 'en',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "hook" TEXT,
    "cta" TEXT,
    "sponsorName" TEXT,
    "sponsorTerms" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "scripts_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "content_topics" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_scripts" ("createdAt", "createdById", "cta", "currentVersion", "format", "hook", "id", "language", "platform", "sponsorName", "sponsorTerms", "status", "title", "topicId", "updatedAt", "workspaceId") SELECT "createdAt", "createdById", "cta", "currentVersion", "format", "hook", "id", "language", "platform", "sponsorName", "sponsorTerms", "status", "title", "topicId", "updatedAt", "workspaceId" FROM "scripts";
DROP TABLE "scripts";
ALTER TABLE "new_scripts" RENAME TO "scripts";
CREATE INDEX "scripts_workspaceId_status_idx" ON "scripts"("workspaceId", "status");
CREATE TABLE "new_workflow_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "input" TEXT,
    "output" TEXT,
    "error" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflow_definitions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_workflow_executions" ("createdAt", "error", "finishedAt", "id", "input", "output", "startedAt", "status", "trigger", "updatedAt", "workflowId", "workspaceId") SELECT "createdAt", "error", "finishedAt", "id", "input", "output", "startedAt", "status", "trigger", "updatedAt", "workflowId", "workspaceId" FROM "workflow_executions";
DROP TABLE "workflow_executions";
ALTER TABLE "new_workflow_executions" RENAME TO "workflow_executions";
CREATE INDEX "workflow_executions_workspaceId_status_idx" ON "workflow_executions"("workspaceId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
