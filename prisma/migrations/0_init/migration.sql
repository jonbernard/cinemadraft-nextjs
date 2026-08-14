-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "enum_leagues_drafting_status" AS ENUM ('pending', 'active', 'complete');

-- CreateEnum
CREATE TYPE "enum_leagues_type" AS ENUM ('linear', 'snake');

-- CreateEnum
CREATE TYPE "enum_lists_status" AS ENUM ('none', 'selected', 'unavailable');

-- CreateEnum
CREATE TYPE "enum_users_role" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "available_years" (
    "id" SERIAL NOT NULL,
    "year" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "available_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "awards" (
    "id" SERIAL NOT NULL,
    "fb_id" TEXT,
    "name" TEXT NOT NULL,
    "event_id" BIGINT NOT NULL,
    "active" BOOLEAN DEFAULT false,
    "points" INTEGER,
    "requires_nominee_name" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_picks" (
    "id" SERIAL NOT NULL,
    "draft_id" INTEGER NOT NULL,
    "movie_id" BIGINT NOT NULL,
    "order" INTEGER NOT NULL,
    "user_id" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "draft_picks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drafts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "league_id" INTEGER,
    "year" INTEGER,
    "group" INTEGER,
    "order" INTEGER,
    "dummy" BOOLEAN,
    "dummy_name" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "fb_id" TEXT,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "image" TEXT,
    "live_results" BOOLEAN DEFAULT false,
    "nom_active" BOOLEAN DEFAULT false,
    "nom_date" BIGINT,
    "nom_time" BIGINT,
    "nom_duration" BIGINT,
    "awards_active" BOOLEAN DEFAULT false,
    "awards_date" BIGINT,
    "awards_time" BIGINT,
    "awards_duration" BIGINT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leagues" (
    "id" SERIAL NOT NULL,
    "fb_id" TEXT,
    "active_year" INTEGER,
    "drafting_status" "enum_leagues_drafting_status",
    "type" "enum_leagues_type",
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "uuid" UUID,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "leagues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lists" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "movie_id" INTEGER,
    "order" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),
    "status" "enum_lists_status" DEFAULT 'none',

    CONSTRAINT "lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movies" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "sort_title" TEXT,
    "fb_id" VARCHAR(255),
    "imdb_id" VARCHAR(255),
    "tmdb_id" VARCHAR(255),
    "backdrop" TEXT,
    "poster" TEXT,
    "release_date" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "movies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nominations" (
    "id" SERIAL NOT NULL,
    "fb_id" TEXT,
    "movie_id" BIGINT NOT NULL,
    "award_id" BIGINT NOT NULL,
    "year" TEXT,
    "detail_name" TEXT,
    "detail_character" TEXT,
    "detail_id" BIGINT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "nominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "message" TEXT,
    "icon" TEXT,
    "link" TEXT,
    "user_id" BIGINT,
    "read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "points" (
    "id" SERIAL NOT NULL,
    "level" VARCHAR(255),
    "tier" INTEGER,
    "points" INTEGER,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_feeds" (
    "id" SERIAL NOT NULL,
    "message" TEXT,
    "icon" TEXT,
    "link" TEXT,
    "components" TEXT,
    "user_uuid" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "profile_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "movie_id" INTEGER,
    "rating" DECIMAL,
    "review" TEXT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "uuid" UUID,
    "first_name" VARCHAR(255),
    "last_name" VARCHAR(255),
    "email" VARCHAR(255) NOT NULL,
    "role" "enum_users_role" DEFAULT 'user',
    "image" TEXT,
    "provider" TEXT,
    "provider_id" TEXT,
    "last_login" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlists" (
    "id" SERIAL NOT NULL,
    "movie_id" BIGINT,
    "user_id" BIGINT,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "winners" (
    "id" SERIAL NOT NULL,
    "fb_id" VARCHAR(255),
    "movie_id" BIGINT NOT NULL,
    "award_id" BIGINT NOT NULL,
    "nomination_id" BIGINT NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "winners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "available_years_year_key" ON "available_years"("year");

-- CreateIndex
CREATE INDEX "awards_event_id" ON "awards"("event_id");

-- CreateIndex
CREATE INDEX "draft_picks_draft_id" ON "draft_picks"("draft_id");

-- CreateIndex
CREATE INDEX "draft_picks_movie_id" ON "draft_picks"("movie_id");

-- CreateIndex
CREATE INDEX "drafts_league_id" ON "drafts"("league_id");

-- CreateIndex
CREATE INDEX "drafts_user_id" ON "drafts"("user_id");

-- CreateIndex
CREATE INDEX "drafts_year" ON "drafts"("year");

-- CreateIndex
CREATE INDEX "events_abbreviation" ON "events"("abbreviation");

-- CreateIndex
CREATE INDEX "events_nom_date_awards_date" ON "events"("nom_date", "awards_date");

-- CreateIndex
CREATE INDEX "lists_user_id" ON "lists"("user_id");

-- CreateIndex
CREATE INDEX "lists_year" ON "lists"("year");

-- CreateIndex
CREATE INDEX "movies_tmdb_id" ON "movies"("tmdb_id");

-- CreateIndex
CREATE INDEX "nominations_award_id" ON "nominations"("award_id");

-- CreateIndex
CREATE INDEX "nominations_movie_id" ON "nominations"("movie_id");

-- CreateIndex
CREATE INDEX "nominations_year" ON "nominations"("year");

-- CreateIndex
CREATE INDEX "notifications_user_id" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "profile_feeds_user_uuid" ON "profile_feeds"("user_uuid");

-- CreateIndex
CREATE INDEX "reviews_movie_id" ON "reviews"("movie_id");

-- CreateIndex
CREATE INDEX "reviews_user_id" ON "reviews"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_provider_id" ON "users"("provider_id");

-- CreateIndex
CREATE INDEX "watchlists_user_id" ON "watchlists"("user_id");

-- CreateIndex
CREATE INDEX "winners_award_id" ON "winners"("award_id");

-- CreateIndex
CREATE INDEX "winners_movie_id" ON "winners"("movie_id");

-- CreateIndex
CREATE INDEX "winners_nomination_id" ON "winners"("nomination_id");

-- CreateIndex
CREATE INDEX "winners_year" ON "winners"("year");

