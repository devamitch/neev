/**
 * Neev Local-First SQLite Database:
 * Provides resilient offline persistence for family functions, rituals,
 * member profiles, and heirloom knowledge.
 */
import * as SQLite from "expo-sqlite"

export const SCHEMA_VERSION = 1
const DB_NAME = "neev.db"

let dbInstance: SQLite.SQLiteDatabase | null = null
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS family_members (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    relationship TEXT NOT NULL,
    role TEXT NOT NULL,
    avatarText TEXT,
    avatarColor TEXT,
    phone TEXT,
    bloodGroup TEXT,
    dateOfBirth TEXT,
    notes TEXT,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS functions_schedule (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT,
    description TEXT,
    reminderSet INTEGER DEFAULT 1,
    tasksJson TEXT,
    updatedAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_vault (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    authorName TEXT NOT NULL,
    authorRole TEXT NOT NULL,
    excerpt TEXT,
    body TEXT NOT NULL,
    tagsJson TEXT,
    isPinned INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    time TEXT NOT NULL,
    category TEXT NOT NULL,
    assignedMember TEXT,
    isCompleted INTEGER DEFAULT 0,
    isShared INTEGER DEFAULT 1,
    updatedAt INTEGER NOT NULL
  );
`

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DB_NAME)
    await db.execAsync("PRAGMA journal_mode = WAL;")
    await db.execAsync("PRAGMA foreign_keys = ON;")
    await db.execAsync(SCHEMA)
    dbInstance = db
    return db
  })()

  return initPromise
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance
  return initDatabase()
}
