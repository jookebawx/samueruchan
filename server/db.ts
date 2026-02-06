import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import {
  InsertCaseStudy,
  InsertUser,
  caseStudies,
  favorites,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

type D1DatabaseLike = Parameters<typeof drizzle>[0];

// Initialize once per worker isolate.
export function initDb(d1: D1DatabaseLike | null | undefined) {
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
  }
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

    const textFields = ["name", "email", "loginMethod"] as const;
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
    } else if (user.openId === ENV.ownerOpenId) {
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

// ========================================
// Case Studies Queries
// ========================================

export async function getAllCaseStudies() {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select()
    .from(caseStudies)
    .orderBy(caseStudies.createdAt);
  return result;
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
  await db.delete(caseStudies).where(eq(caseStudies.id, id));
  return true;
}
