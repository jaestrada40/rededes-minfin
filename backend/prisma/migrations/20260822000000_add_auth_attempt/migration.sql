CREATE TABLE "AuthAttempt" (
  "key" TEXT NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthAttempt_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "AuthAttempt_expiresAt_idx" ON "AuthAttempt"("expiresAt");
