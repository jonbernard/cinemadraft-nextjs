/*
  Warnings:

  - The primary key for the `awards` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `draft_picks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `drafts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `leagues` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `lists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `movies` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `nominations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `detailId` on the `nominations` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - The primary key for the `notifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `points` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `profile_feeds` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `userUuid` column on the `profile_feeds` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `reviews` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `watchlists` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `winners` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "awards" DROP CONSTRAINT "awards_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "eventId" SET DATA TYPE TEXT,
ADD CONSTRAINT "awards_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "awards_id_seq";

-- AlterTable
ALTER TABLE "draft_picks" DROP CONSTRAINT "draft_picks_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "draftId" SET DATA TYPE TEXT,
ALTER COLUMN "movieId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "draft_picks_id_seq";

-- AlterTable
ALTER TABLE "drafts" DROP CONSTRAINT "drafts_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "leagueId" SET DATA TYPE TEXT,
ADD CONSTRAINT "drafts_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "drafts_id_seq";

-- AlterTable
ALTER TABLE "events" DROP CONSTRAINT "events_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "events_id_seq";

-- AlterTable
ALTER TABLE "leagues" DROP CONSTRAINT "leagues_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "leagues_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "leagues_id_seq";

-- AlterTable
ALTER TABLE "lists" DROP CONSTRAINT "lists_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "movieId" SET DATA TYPE TEXT,
ADD CONSTRAINT "lists_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "lists_id_seq";

-- AlterTable
ALTER TABLE "movies" DROP CONSTRAINT "movies_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "movies_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "movies_id_seq";

-- AlterTable
ALTER TABLE "nominations" DROP CONSTRAINT "nominations_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "movieId" SET DATA TYPE TEXT,
ALTER COLUMN "awardId" SET DATA TYPE TEXT,
ALTER COLUMN "detailId" SET DATA TYPE INTEGER,
ADD CONSTRAINT "nominations_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "nominations_id_seq";

-- AlterTable
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "notifications_id_seq";

-- AlterTable
ALTER TABLE "points" DROP CONSTRAINT "points_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "points_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "points_id_seq";

-- AlterTable
ALTER TABLE "profile_feeds" DROP CONSTRAINT "profile_feeds_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
DROP COLUMN "userUuid",
ADD COLUMN     "userUuid" UUID,
ADD CONSTRAINT "profile_feeds_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "profile_feeds_id_seq";

-- AlterTable
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ALTER COLUMN "movieId" SET DATA TYPE TEXT,
ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "reviews_id_seq";

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
ADD COLUMN     "email_verified" TIMESTAMP(3),
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "users_id_seq";

-- AlterTable
ALTER TABLE "watchlists" DROP CONSTRAINT "watchlists_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "movieId" SET DATA TYPE TEXT,
ALTER COLUMN "userId" SET DATA TYPE TEXT,
ADD CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "watchlists_id_seq";

-- AlterTable
ALTER TABLE "winners" DROP CONSTRAINT "winners_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "movieId" SET DATA TYPE TEXT,
ALTER COLUMN "awardId" SET DATA TYPE TEXT,
ALTER COLUMN "nominationId" SET DATA TYPE TEXT,
ADD CONSTRAINT "winners_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "winners_id_seq";

-- CreateIndex
CREATE INDEX "ProfileFeeds_userUuid" ON "profile_feeds"("userUuid");

-- AddForeignKey
ALTER TABLE "awards" ADD CONSTRAINT "awards_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "drafts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "leagues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lists" ADD CONSTRAINT "lists_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nominations" ADD CONSTRAINT "nominations_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_feeds" ADD CONSTRAINT "profile_feeds_userUuid_fkey" FOREIGN KEY ("userUuid") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "winners" ADD CONSTRAINT "winners_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "movies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "winners" ADD CONSTRAINT "winners_awardId_fkey" FOREIGN KEY ("awardId") REFERENCES "awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "winners" ADD CONSTRAINT "winners_nominationId_fkey" FOREIGN KEY ("nominationId") REFERENCES "nominations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
