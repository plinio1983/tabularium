CREATE TYPE "NotificationType" AS ENUM (
  'RECURRING_EXPENSE_CREATED',
  'RECURRING_INCOME_CREATED',
  'EXPENSE_DUE_SOON',
  'EXPENSE_OVERDUE',
  'INCOME_DUE_SOON',
  'INCOME_OVERDUE',
  'AUTOMATIC_PAYMENT_COMPLETED',
  'AUTOMATIC_PAYMENT_FAILED',
  'AUTOMATIC_CREDIT_COMPLETED',
  'AUTOMATIC_CREDIT_FAILED',
  'RECURRING_JOB_FAILED'
);

CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

CREATE TABLE "Notification" (
  "id" BIGSERIAL NOT NULL,
  "workspaceId" INTEGER NOT NULL,
  "companyId" INTEGER,
  "type" "NotificationType" NOT NULL,
  "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "actionUrl" TEXT,
  "sourceType" TEXT,
  "sourceId" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationRecipient" (
  "notificationId" BIGINT NOT NULL,
  "userId" INTEGER NOT NULL,
  "readAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("notificationId", "userId")
);

CREATE UNIQUE INDEX "Notification_workspaceId_dedupeKey_key" ON "Notification"("workspaceId", "dedupeKey");
CREATE INDEX "Notification_workspaceId_companyId_occurredAt_idx" ON "Notification"("workspaceId", "companyId", "occurredAt");
CREATE INDEX "Notification_type_occurredAt_idx" ON "Notification"("type", "occurredAt");
CREATE INDEX "Notification_expiresAt_idx" ON "Notification"("expiresAt");
CREATE INDEX "NotificationRecipient_userId_readAt_archivedAt_idx" ON "NotificationRecipient"("userId", "readAt", "archivedAt");
CREATE INDEX "NotificationRecipient_userId_createdAt_idx" ON "NotificationRecipient"("userId", "createdAt");
CREATE INDEX "Expense_dueDate_idx" ON "Expense"("dueDate");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationRecipient" ADD CONSTRAINT "NotificationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
