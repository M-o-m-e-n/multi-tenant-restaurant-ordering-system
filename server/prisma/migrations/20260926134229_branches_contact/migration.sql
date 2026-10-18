-- CreateEnum
CREATE TYPE "ContactKind" AS ENUM ('COMPLAINT', 'SUGGESTION', 'QUESTION');

-- CreateTable
CREATE TABLE "Branch" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "nameAr" VARCHAR(80) NOT NULL,
    "nameEn" VARCHAR(80) NOT NULL,
    "addressAr" VARCHAR(200) NOT NULL,
    "addressEn" VARCHAR(200) NOT NULL,
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "whatsapp" VARCHAR(30),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "hours" JSONB NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" UUID NOT NULL,
    "branchId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "kind" "ContactKind" NOT NULL,
    "tableNumber" VARCHAR(10),
    "visitDate" DATE,
    "message" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_slug_key" ON "Branch"("slug");

-- CreateIndex
CREATE INDEX "ContactMessage_readAt_createdAt_idx" ON "ContactMessage"("readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "ContactMessage" ADD CONSTRAINT "ContactMessage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
