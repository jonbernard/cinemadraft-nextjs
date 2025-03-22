-- CreateEnum
CREATE TYPE "enum_Leagues_draftingStatus" AS ENUM ('pending', 'active', 'complete');

-- CreateEnum
CREATE TYPE "enum_Leagues_type" AS ENUM ('linear', 'snake');

-- CreateEnum
CREATE TYPE "enum_Lists_status" AS ENUM ('none', 'selected', 'unavailable');

-- CreateEnum
CREATE TYPE "enum_Users_role" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "AvailableYears" (
    "id" SERIAL NOT NULL,
    "year" INTEGER,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "AvailableYears_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Awards" (
    "id" SERIAL NOT NULL,
    "fbId" TEXT,
    "name" TEXT NOT NULL,
    "eventId" BIGINT NOT NULL,
    "active" BOOLEAN DEFAULT false,
    "points" INTEGER,
    "requiresNomineeName" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPicks" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "movieId" BIGINT NOT NULL,
    "order" INTEGER NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "DraftPicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drafts" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "leagueId" INTEGER,
    "year" INTEGER,
    "group" INTEGER,
    "order" INTEGER,
    "dummy" BOOLEAN,
    "dummyName" TEXT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Events" (
    "id" SERIAL NOT NULL,
    "fbId" TEXT,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "image" TEXT,
    "liveResults" BOOLEAN DEFAULT false,
    "nomActive" BOOLEAN DEFAULT false,
    "nomDate" BIGINT,
    "nomTime" BIGINT,
    "nomDuration" BIGINT,
    "awardsActive" BOOLEAN DEFAULT false,
    "awardsDate" BIGINT,
    "awardsTime" BIGINT,
    "awardsDuration" BIGINT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Leagues" (
    "id" SERIAL NOT NULL,
    "fbId" TEXT,
    "activeYear" INTEGER,
    "draftingStatus" "enum_Leagues_draftingStatus",
    "type" "enum_Leagues_type",
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "uuid" UUID,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lists" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "movieId" INTEGER,
    "order" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),
    "status" "enum_Lists_status" DEFAULT 'none',

    CONSTRAINT "Lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movies" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "sortTitle" TEXT,
    "fbId" VARCHAR(255),
    "imdbId" VARCHAR(255),
    "tmdbId" VARCHAR(255),
    "backdrop" TEXT,
    "poster" TEXT,
    "releaseDate" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nominations" (
    "id" SERIAL NOT NULL,
    "fbId" TEXT,
    "movieId" BIGINT NOT NULL,
    "awardId" BIGINT NOT NULL,
    "year" TEXT,
    "detailName" TEXT,
    "detailCharacter" TEXT,
    "detailId" BIGINT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notifications" (
    "id" SERIAL NOT NULL,
    "message" TEXT,
    "icon" TEXT,
    "link" TEXT,
    "userId" BIGINT,
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Points" (
    "id" SERIAL NOT NULL,
    "level" VARCHAR(255),
    "tier" INTEGER,
    "points" INTEGER,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileFeeds" (
    "id" SERIAL NOT NULL,
    "message" TEXT,
    "icon" TEXT,
    "link" TEXT,
    "components" TEXT,
    "userUuid" TEXT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ProfileFeeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reviews" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "movieId" INTEGER,
    "rating" DECIMAL,
    "review" TEXT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequelizeMeta" (
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "Users" (
    "id" SERIAL NOT NULL,
    "uuid" UUID,
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "role" "enum_Users_role" DEFAULT 'user',
    "salt" TEXT,
    "password" TEXT,
    "image" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "lastLogin" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Watchlists" (
    "id" SERIAL NOT NULL,
    "movieId" BIGINT,
    "userId" BIGINT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Winners" (
    "id" SERIAL NOT NULL,
    "fbId" VARCHAR(255),
    "movieId" BIGINT NOT NULL,
    "awardId" BIGINT NOT NULL,
    "nominationId" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Winners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvailableYears_year_key" ON "AvailableYears"("year");

-- CreateIndex
CREATE INDEX "Awards_eventId" ON "Awards"("eventId");

-- CreateIndex
CREATE INDEX "DraftPicks_draftId" ON "DraftPicks"("draftId");

-- CreateIndex
CREATE INDEX "DraftPicks_movieId" ON "DraftPicks"("movieId");

-- CreateIndex
CREATE INDEX "Drafts_leagueId" ON "Drafts"("leagueId");

-- CreateIndex
CREATE INDEX "Drafts_userId" ON "Drafts"("userId");

-- CreateIndex
CREATE INDEX "Drafts_year" ON "Drafts"("year");

-- CreateIndex
CREATE INDEX "Events_abbreviation" ON "Events"("abbreviation");

-- CreateIndex
CREATE INDEX "Events_nomDate_awardsDate" ON "Events"("nomDate", "awardsDate");

-- CreateIndex
CREATE INDEX "Lists_userId" ON "Lists"("userId");

-- CreateIndex
CREATE INDEX "Lists_year" ON "Lists"("year");

-- CreateIndex
CREATE INDEX "Movies_tmdbId" ON "Movies"("tmdbId");

-- CreateIndex
CREATE INDEX "Nominations_awardId" ON "Nominations"("awardId");

-- CreateIndex
CREATE INDEX "Nominations_movieId" ON "Nominations"("movieId");

-- CreateIndex
CREATE INDEX "Nominations_year" ON "Nominations"("year");

-- CreateIndex
CREATE INDEX "Notifications_userId" ON "Notifications"("userId");

-- CreateIndex
CREATE INDEX "ProfileFeeds_userUuid" ON "ProfileFeeds"("userUuid");

-- CreateIndex
CREATE INDEX "Reviews_movieId" ON "Reviews"("movieId");

-- CreateIndex
CREATE INDEX "Reviews_userId" ON "Reviews"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Users_uuid_key" ON "Users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Users_email_key" ON "Users"("email");

-- CreateIndex
CREATE INDEX "Users_providerId" ON "Users"("providerId");

-- CreateIndex
CREATE INDEX "Users_uuid" ON "Users"("uuid");

-- CreateIndex
CREATE INDEX "Watchlists_userId" ON "Watchlists"("userId");

-- CreateIndex
CREATE INDEX "Winners_awardId" ON "Winners"("awardId");

-- CreateIndex
CREATE INDEX "Winners_movieId" ON "Winners"("movieId");

-- CreateIndex
CREATE INDEX "Winners_nominationId" ON "Winners"("nominationId");

-- CreateIndex
CREATE INDEX "Winners_year" ON "Winners"("year");
