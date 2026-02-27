import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  InsertCaseStudy,
  InsertQuest,
  InsertQuestAnswer,
  InsertReport,
  InsertUser,
  caseStudies,
  favorites,
  questAnswers,
  quests,
  reports,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbBinding: D1DatabaseLike | null = null;
let _avatarColumnEnsured = false;
let _reportsTableEnsured = false;
let _questTablesEnsured = false;

type D1DatabaseLike = Parameters<typeof drizzle>[0];

type D1StatementLike = {
  run: () => Promise<unknown>;
};

type D1BindingLike = {
  prepare?: (query: string) => D1StatementLike;
};

async function ensureAvatarColumn() {
  if (_avatarColumnEnsured || !_dbBinding) return;
  _avatarColumnEnsured = true;

  const binding = _dbBinding as unknown as D1BindingLike;
  if (typeof binding.prepare !== "function") return;

  try {
    await binding.prepare("ALTER TABLE users ADD COLUMN avatarUrl TEXT").run();
    console.log("[Database] Added users.avatarUrl column.");
  } catch (error) {
    const message = String(error).toLowerCase();
    const isAlreadyExists =
      message.includes("duplicate column name") ||
      message.includes("already exists");
    if (!isAlreadyExists) {
      console.warn("[Database] Failed to add users.avatarUrl column:", error);
    }
  }
}

async function ensureReportsTable() {
  if (_reportsTableEnsured || !_dbBinding) return;
  _reportsTableEnsured = true;

  const binding = _dbBinding as unknown as D1BindingLike;
  if (typeof binding.prepare !== "function") return;

  try {
    await binding
      .prepare(
        "CREATE TABLE IF NOT EXISTS reports (" +
          "id integer primary key autoincrement, " +
          "user_id integer not null references users(id) on delete cascade, " +
          "case_study_id integer not null references case_studies(id) on delete cascade, " +
          "created_at integer not null default (unixepoch() * 1000)" +
          ")"
      )
      .run();
    await binding
      .prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS reports_user_case_unique ON reports(user_id, case_study_id)"
      )
      .run();
  } catch (error) {
    console.warn("[Database] Failed to create reports table:", error);
  }
}

async function ensureQuestTables() {
  if (_questTablesEnsured || !_dbBinding) return;
  _questTablesEnsured = true;

  const binding = _dbBinding as unknown as D1BindingLike;
  if (typeof binding.prepare !== "function") return;

  try {
    await binding
      .prepare(
        "CREATE TABLE IF NOT EXISTS quests (" +
          "id integer primary key autoincrement, " +
          "user_id integer not null references users(id) on delete cascade, " +
          "title text not null, " +
          "content text not null, " +
          "status text not null default 'open', " +
          "solved_answer_id integer, " +
          "solver_user_id integer, " +
          "created_at integer not null default (unixepoch() * 1000), " +
          "updated_at integer not null default (unixepoch() * 1000), " +
          "closed_at integer" +
          ")"
      )
      .run();
    try {
      await binding
        .prepare("ALTER TABLE quests ADD COLUMN solved_answer_id integer")
        .run();
    } catch (error) {
      const message = String(error).toLowerCase();
      const isAlreadyExists =
        message.includes("duplicate column name") ||
        message.includes("already exists");
      if (!isAlreadyExists) {
        throw error;
      }
    }
    try {
      await binding
        .prepare("ALTER TABLE quests ADD COLUMN solver_user_id integer")
        .run();
    } catch (error) {
      const message = String(error).toLowerCase();
      const isAlreadyExists =
        message.includes("duplicate column name") ||
        message.includes("already exists");
      if (!isAlreadyExists) {
        throw error;
      }
    }
    // Backward compatibility for early quest status values.
    await binding
      .prepare("UPDATE quests SET status = 'unsolved' WHERE status = 'closed'")
      .run();
    await binding
      .prepare("CREATE INDEX IF NOT EXISTS quests_status_idx ON quests(status)")
      .run();
    await binding
      .prepare(
        "CREATE TABLE IF NOT EXISTS quest_answers (" +
          "id integer primary key autoincrement, " +
          "quest_id integer not null references quests(id) on delete cascade, " +
          "user_id integer not null references users(id) on delete cascade, " +
          "content text not null, " +
          "created_at integer not null default (unixepoch() * 1000), " +
          "updated_at integer not null default (unixepoch() * 1000)" +
          ")"
      )
      .run();
    await binding
      .prepare(
        "CREATE INDEX IF NOT EXISTS quest_answers_quest_idx ON quest_answers(quest_id)"
      )
      .run();
  } catch (error) {
    console.warn("[Database] Failed to create quest tables:", error);
  }
}

// Initialize once per worker isolate.
export function initDb(d1: D1DatabaseLike | null | undefined) {
  if (d1) {
    _dbBinding = d1;
  }
  if (!_db && d1) {
    _db = drizzle(d1);
  }
  return _db;
}

// Lazily return the cached database instance.
export async function getDb() {
  if (!_db) {
    console.warn(
      "[Database] Database not initialized. Call initDb with the D1 binding."
    );
    return _db;
  }
  await ensureAvatarColumn();
  await ensureReportsTable();
  await ensureQuestTables();
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "avatarUrl", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (ENV.ownerOpenIds.includes(user.openId)) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = Date.now();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = Date.now();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserPublicById(userId: number) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserName(userId: number, name: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return false;
  }

  await db
    .update(users)
    .set({
      name,
      updatedAt: Date.now(),
    })
    .where(eq(users.id, userId));

  return true;
}

// ========================================
// Case Studies Queries
// ========================================

export async function getAllCaseStudies() {
  const db = await getDb();
  if (!db) return [];
  
  const [casesResult, reportsResult] = await Promise.all([
    db
      .select({
        caseStudy: caseStudies,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(caseStudies)
      .leftJoin(users, eq(caseStudies.userId, users.id))
      .orderBy(caseStudies.createdAt),
    db.select({ caseStudyId: reports.caseStudyId }).from(reports),
  ]);

  const reportCountByCaseId = new Map<number, number>();
  for (const row of reportsResult) {
    const current = reportCountByCaseId.get(row.caseStudyId) ?? 0;
    reportCountByCaseId.set(row.caseStudyId, current + 1);
  }

  return casesResult.map(row => ({
    ...row.caseStudy,
    authorName: row.authorName ?? null,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
    reportCount: reportCountByCaseId.get(row.caseStudy.id) ?? 0,
  }));
}

export async function getCaseStudyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db
    .select()
    .from(caseStudies)
    .where(eq(caseStudies.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCaseStudy(data: InsertCaseStudy) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(caseStudies).values(data);
  // Get the last inserted record by userId and timestamp
  const [inserted] = await db
    .select({ id: caseStudies.id })
    .from(caseStudies)
    .where(eq(caseStudies.userId, data.userId))
    .orderBy(desc(caseStudies.createdAt))
    .limit(1);
  return { insertId: inserted?.id || 0 };
}

export async function updateCaseStudy(
  id: number,
  data: Partial<Omit<InsertCaseStudy, "userId">>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateSet: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateSet[key] = value;
    }
  }

  await db.update(caseStudies).set(updateSet).where(eq(caseStudies.id, id));
  return true;
}

export async function getUserCaseStudies(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(caseStudies)
    .where(eq(caseStudies.userId, userId))
    .orderBy(caseStudies.createdAt);
  return result;
}

// ========================================
// Quests Queries
// ========================================

export async function getAllQuests() {
  const db = await getDb();
  if (!db) return [];

  const [questsResult, answersResult] = await Promise.all([
    db
      .select({
        quest: quests,
        authorName: users.name,
        authorAvatarUrl: users.avatarUrl,
      })
      .from(quests)
      .leftJoin(users, eq(quests.userId, users.id))
      .orderBy(desc(quests.createdAt)),
    db.select({ questId: questAnswers.questId }).from(questAnswers),
  ]);

  const answerCountByQuestId = new Map<number, number>();
  for (const row of answersResult) {
    const current = answerCountByQuestId.get(row.questId) ?? 0;
    answerCountByQuestId.set(row.questId, current + 1);
  }

  return questsResult.map(row => ({
    ...row.quest,
    authorName: row.authorName ?? null,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
    answerCount: answerCountByQuestId.get(row.quest.id) ?? 0,
  }));
}

export async function getQuestById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      quest: quests,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(quests)
    .leftJoin(users, eq(quests.userId, users.id))
    .where(eq(quests.id, id))
    .limit(1);

  if (result.length === 0) return undefined;

  return {
    ...result[0].quest,
    authorName: result[0].authorName ?? null,
    authorAvatarUrl: result[0].authorAvatarUrl ?? null,
  };
}

export async function getQuestAnswers(questId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      id: questAnswers.id,
      questId: questAnswers.questId,
      userId: questAnswers.userId,
      content: questAnswers.content,
      createdAt: questAnswers.createdAt,
      updatedAt: questAnswers.updatedAt,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(questAnswers)
    .leftJoin(users, eq(questAnswers.userId, users.id))
    .where(eq(questAnswers.questId, questId))
    .orderBy(questAnswers.createdAt);

  return result.map(row => ({
    ...row,
    authorName: row.authorName ?? null,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
  }));
}

export async function createQuest(data: InsertQuest) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(quests).values(data);
  const [inserted] = await db
    .select({ id: quests.id })
    .from(quests)
    .where(eq(quests.userId, data.userId))
    .orderBy(desc(quests.createdAt))
    .limit(1);

  return { insertId: inserted?.id || 0 };
}

export async function createQuestAnswer(data: InsertQuestAnswer) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(questAnswers).values(data);
  const [inserted] = await db
    .select({ id: questAnswers.id })
    .from(questAnswers)
    .where(
      and(
        eq(questAnswers.questId, data.questId),
        eq(questAnswers.userId, data.userId)
      )
    )
    .orderBy(desc(questAnswers.createdAt))
    .limit(1);

  return { insertId: inserted?.id || 0 };
}

export async function getQuestAnswerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select({
      id: questAnswers.id,
      questId: questAnswers.questId,
      userId: questAnswers.userId,
      content: questAnswers.content,
      createdAt: questAnswers.createdAt,
      updatedAt: questAnswers.updatedAt,
    })
    .from(questAnswers)
    .where(eq(questAnswers.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type QuestClosedStatus = "finished" | "suspended" | "unsolved";

export async function closeQuest(
  id: number,
  data: {
    status: QuestClosedStatus;
    solvedAnswerId: number | null;
    solverUserId: number | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(quests)
    .set({
      status: data.status,
      solvedAnswerId: data.solvedAnswerId,
      solverUserId: data.solverUserId,
      closedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(quests.id, id));

  return true;
}

// ========================================
// Favorites Queries
// ========================================

export async function getUserFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: favorites.id,
      caseStudyId: favorites.caseStudyId,
      createdAt: favorites.createdAt,
      caseStudy: caseStudies,
    })
    .from(favorites)
    .innerJoin(caseStudies, eq(favorites.caseStudyId, caseStudies.id))
    .where(eq(favorites.userId, userId))
    .orderBy(favorites.createdAt);
  
  return result;
}

export async function getUserReportedCaseStudyIds(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({ caseStudyId: reports.caseStudyId })
    .from(reports)
    .where(eq(reports.userId, userId));

  return result.map(item => item.caseStudyId);
}

export async function isFavorite(userId: number, caseStudyId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db
    .select()
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.caseStudyId, caseStudyId))
    )
    .limit(1);
  
  return result.length > 0;
}

export async function addFavorite(userId: number, caseStudyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  try {
    await db.insert(favorites).values({ userId, caseStudyId });
    return true;
  } catch (error) {
    // 既にお気に入りに追加済みの場合はエラーを無視
    return false;
  }
}

export async function createReport(data: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  try {
    await db.insert(reports).values(data);
    return { created: true };
  } catch (_error) {
    return { created: false };
  }
}

export async function removeFavorite(userId: number, caseStudyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(favorites)
    .where(
      and(eq(favorites.userId, userId), eq(favorites.caseStudyId, caseStudyId))
    );
  
  return true;
}

export async function deleteCaseStudy(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(favorites).where(eq(favorites.caseStudyId, id));
  await db.delete(reports).where(eq(reports.caseStudyId, id));
  await db.delete(caseStudies).where(eq(caseStudies.id, id));
  return true;
}
