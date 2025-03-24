-- CreateEnum
CREATE TYPE "enum_Leagues_draftingStatus" AS ENUM ('pending', 'active', 'complete');

-- CreateEnum
CREATE TYPE "enum_Leagues_type" AS ENUM ('linear', 'snake');

-- CreateEnum
CREATE TYPE "enum_Lists_status" AS ENUM ('none', 'selected', 'unavailable');

-- CreateEnum
CREATE TYPE "enum_Users_role" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "available_years" (
    "id" SERIAL NOT NULL,
    "year" INTEGER,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "available_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" SERIAL NOT NULL,
    "fbId" TEXT,
    "name" TEXT NOT NULL,
    "eventId" BIGINT NOT NULL,
    "active" BOOLEAN DEFAULT false,
    "points" INTEGER,
    "requiresNomineeName" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_picks" (
    "id" SERIAL NOT NULL,
    "draftId" INTEGER NOT NULL,
    "movieId" BIGINT NOT NULL,
    "order" INTEGER NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
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

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
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

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
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

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lists" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "movieId" INTEGER,
    "order" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),
    "status" "enum_Lists_status" DEFAULT 'none',

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movies" (
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

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominations" (
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

    CONSTRAINT "nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "message" TEXT,
    "icon" TEXT,
    "link" TEXT,
    "userId" BIGINT,
    "read" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points" (
    "id" SERIAL NOT NULL,
    "level" VARCHAR(255),
    "tier" INTEGER,
    "points" INTEGER,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_feeds" (
    "id" SERIAL NOT NULL,
    "message" TEXT,
    "icon" TEXT,
    "link" TEXT,
    "components" TEXT,
    "userUuid" TEXT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "profile_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "movieId" INTEGER,
    "rating" DECIMAL,
    "review" TEXT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequelizeMeta" (
    "name" VARCHAR(255) NOT NULL,

    CONSTRAINT "SequelizeMeta_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "users" (
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

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" SERIAL NOT NULL,
    "movieId" BIGINT,
    "userId" BIGINT,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "winners" (
    "id" SERIAL NOT NULL,
    "fbId" VARCHAR(255),
    "movieId" BIGINT NOT NULL,
    "awardId" BIGINT NOT NULL,
    "nominationId" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6),
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "winners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "available_years_year_key" ON "available_years"("year");

-- CreateIndex
CREATE INDEX "Awards_eventId" ON "awards"("eventId");

-- CreateIndex
CREATE INDEX "DraftPicks_draftId" ON "draft_picks"("draftId");

-- CreateIndex
CREATE INDEX "DraftPicks_movieId" ON "draft_picks"("movieId");

-- CreateIndex
CREATE INDEX "Drafts_leagueId" ON "drafts"("leagueId");

-- CreateIndex
CREATE INDEX "Drafts_userId" ON "drafts"("userId");

-- CreateIndex
CREATE INDEX "Drafts_year" ON "drafts"("year");

-- CreateIndex
CREATE INDEX "Events_abbreviation" ON "events"("abbreviation");

-- CreateIndex
CREATE INDEX "Events_nomDate_awardsDate" ON "events"("nomDate", "awardsDate");

-- CreateIndex
CREATE INDEX "Lists_userId" ON "lists"("userId");

-- CreateIndex
CREATE INDEX "Lists_year" ON "lists"("year");

-- CreateIndex
CREATE INDEX "Movies_tmdbId" ON "movies"("tmdbId");

-- CreateIndex
CREATE INDEX "Nominations_awardId" ON "nominations"("awardId");

-- CreateIndex
CREATE INDEX "Nominations_movieId" ON "nominations"("movieId");

-- CreateIndex
CREATE INDEX "Nominations_year" ON "nominations"("year");

-- CreateIndex
CREATE INDEX "Notifications_userId" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "ProfileFeeds_userUuid" ON "profile_feeds"("userUuid");

-- CreateIndex
CREATE INDEX "Reviews_movieId" ON "reviews"("movieId");

-- CreateIndex
CREATE INDEX "Reviews_userId" ON "reviews"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "Users_providerId" ON "users"("providerId");

-- CreateIndex
CREATE INDEX "Users_uuid" ON "users"("uuid");

-- CreateIndex
CREATE INDEX "Watchlists_userId" ON "watchlists"("userId");

-- CreateIndex
CREATE INDEX "Winners_awardId" ON "winners"("awardId");

-- CreateIndex
CREATE INDEX "Winners_movieId" ON "winners"("movieId");

-- CreateIndex
CREATE INDEX "Winners_nominationId" ON "winners"("nominationId");

-- CreateIndex
CREATE INDEX "Winners_year" ON "winners"("year");

