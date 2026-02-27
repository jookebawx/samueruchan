import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const nowMs = sql`(unixepoch() * 1000)`;

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = sqliteTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** OAuth identifier (openId) returned from the callback. Unique per user. */
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatarUrl"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("createdAt").notNull().default(nowMs),
  updatedAt: integer("updatedAt").notNull().default(nowMs),
  lastSignedIn: integer("lastSignedIn").notNull().default(nowMs),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Case studies table.
 */
export const caseStudies = sqliteTable("case_studies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** Author user id */
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Case study title */
  title: text("title").notNull(),
  /** Short description */
  description: text("description").notNull(),
  /** Thumbnail URL */
  thumbnailUrl: text("thumbnail_url"),
  /** Thumbnail storage key */
  thumbnailKey: text("thumbnail_key"),
  /** Category */
  category: text("category", {
    enum: ["prompt", "automation", "tools", "business"],
  }).notNull(),
  /** Tools used (JSON array) */
  tools: text("tools").notNull(),
  /** Challenge */
  challenge: text("challenge").notNull(),
  /** Solution */
  solution: text("solution").notNull(),
  /** Steps (JSON array) */
  steps: text("steps").notNull(),
  /** Impact */
  impact: text("impact"),
  /** Tags (JSON array) */
  tags: text("tags").notNull(),
  /** Recommended flag */
  isRecommended: integer("is_recommended").notNull().default(0),
  createdAt: integer("created_at").notNull().default(nowMs),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export type CaseStudy = typeof caseStudies.$inferSelect;
export type InsertCaseStudy = typeof caseStudies.$inferInsert;

/**
 * Favorites table.
 */
export const favorites = sqliteTable(
  "favorites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caseStudyId: integer("case_study_id")
      .notNull()
      .references(() => caseStudies.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => ({
    uniqueUserCase: uniqueIndex("favorites_user_case_unique").on(
      table.userId,
      table.caseStudyId
    ),
  })
);

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

/**
 * Reports table.
 */
export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caseStudyId: integer("case_study_id")
      .notNull()
      .references(() => caseStudies.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  table => ({
    uniqueUserCase: uniqueIndex("reports_user_case_unique").on(
      table.userId,
      table.caseStudyId
    ),
  })
);

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

/**
 * Quests table.
 */
export const quests = sqliteTable(
  "quests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
    closedAt: integer("closed_at"),
  },
  table => ({
    statusIdx: index("quests_status_idx").on(table.status),
  })
);

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = typeof quests.$inferInsert;

/**
 * Quest answers table.
 */
export const questAnswers = sqliteTable(
  "quest_answers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    questId: integer("quest_id")
      .notNull()
      .references(() => quests.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: integer("created_at").notNull().default(nowMs),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  table => ({
    questIdx: index("quest_answers_quest_idx").on(table.questId),
  })
);

export type QuestAnswer = typeof questAnswers.$inferSelect;
export type InsertQuestAnswer = typeof questAnswers.$inferInsert;
