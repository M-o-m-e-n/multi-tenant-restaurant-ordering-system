-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ModifierGroup" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "ModifierItem" ADD COLUMN     "translations" JSONB NOT NULL DEFAULT '{}';
