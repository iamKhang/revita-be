/*
  Warnings:

  - You are about to drop the column `thumbnail` on the `posts` table. All the data in the column will be lost.
  - The `status` column on the `posts` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

-- AlterTable
ALTER TABLE "post_categories" ADD COLUMN     "author_id" TEXT,
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "posts" DROP COLUMN "thumbnail",
ADD COLUMN     "cover_image" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "series" ADD COLUMN     "author_id" TEXT,
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT';

-- DropEnum
DROP TYPE "PostStatus";

-- AddForeignKey
ALTER TABLE "post_categories" ADD CONSTRAINT "post_categories_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "series" ADD CONSTRAINT "series_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
