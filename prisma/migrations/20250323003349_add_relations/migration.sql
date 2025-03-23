/*
  Warnings:

  - You are about to alter the column `eventId` on the `Awards` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `movieId` on the `DraftPicks` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `movieId` on the `Nominations` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `awardId` on the `Nominations` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `detailId` on the `Nominations` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `userId` on the `Notifications` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - The `userUuid` column on the `ProfileFeeds` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `movieId` on the `Watchlists` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `userId` on the `Watchlists` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `movieId` on the `Winners` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `awardId` on the `Winners` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - You are about to alter the column `nominationId` on the `Winners` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Awards" ALTER COLUMN "eventId" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "DraftPicks" ALTER COLUMN "movieId" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Nominations" ALTER COLUMN "movieId" SET DATA TYPE INTEGER,
ALTER COLUMN "awardId" SET DATA TYPE INTEGER,
ALTER COLUMN "detailId" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Notifications" ALTER COLUMN "userId" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "ProfileFeeds" DROP COLUMN "userUuid",
ADD COLUMN     "userUuid" UUID;

-- AlterTable
ALTER TABLE "Watchlists" ALTER COLUMN "movieId" SET DATA TYPE INTEGER,
ALTER COLUMN "userId" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "Winners" ALTER COLUMN "movieId" SET DATA TYPE INTEGER,
ALTER COLUMN "awardId" SET DATA TYPE INTEGER,
ALTER COLUMN "nominationId" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE INDEX "ProfileFeeds_userUuid" ON "ProfileFeeds"("userUuid");

-- AddForeignKey
ALTER TABLE "Awards" ADD CONSTRAINT "Awards_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPicks" ADD CONSTRAINT "DraftPicks_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "Drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPicks" ADD CONSTRAINT "DraftPicks_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPicks" ADD CONSTRAINT "DraftPicks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drafts" ADD CONSTRAINT "Drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drafts" ADD CONSTRAINT "Drafts_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "Leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lists" ADD CONSTRAINT "Lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lists" ADD CONSTRAINT "Lists_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nominations" ADD CONSTRAINT "Nominations_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nominations" ADD CONSTRAINT "Nominations_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notifications" ADD CONSTRAINT "Notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileFeeds" ADD CONSTRAINT "ProfileFeeds_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "Users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reviews" ADD CONSTRAINT "Reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reviews" ADD CONSTRAINT "Reviews_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlists" ADD CONSTRAINT "Watchlists_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Watchlists" ADD CONSTRAINT "Watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winners" ADD CONSTRAINT "Winners_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winners" ADD CONSTRAINT "Winners_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "Awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Winners" ADD CONSTRAINT "Winners_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "Nominations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
