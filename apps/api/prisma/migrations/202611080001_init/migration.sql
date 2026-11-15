CREATE TABLE "Record" ("id" TEXT PRIMARY KEY,"resource" TEXT NOT NULL,"data" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "Record_resource_createdAt_idx" ON "Record"("resource","createdAt");
CREATE TABLE "User" ("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"email" TEXT NOT NULL UNIQUE,"role" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'active',"passwordHash" TEXT NOT NULL);
CREATE TABLE "Session" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "Setting" ("id" TEXT PRIMARY KEY DEFAULT 'default',"data" JSONB NOT NULL);
CREATE TABLE "Idempotency" ("key" TEXT PRIMARY KEY,"userId" TEXT NOT NULL,"operation" TEXT NOT NULL,"requestHash" TEXT NOT NULL,"result" JSONB NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
