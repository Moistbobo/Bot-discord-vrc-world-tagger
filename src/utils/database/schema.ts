import type Database from 'better-sqlite3';
import logger from '../logger';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS world_records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id       TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    message_id     TEXT    NOT NULL,
    name           TEXT,
    author_name    TEXT,
    capacity       INTEGER,
    platforms      TEXT,   -- JSON array string
    tags           TEXT,   -- JSON array string
    image_url      TEXT,
    source_content TEXT,
    vrchat_data    TEXT,   -- Full VRChat API response as JSON blob
    created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),

    UNIQUE(world_id, guild_id)
  );

  CREATE INDEX IF NOT EXISTS idx_worlds_world_id   ON world_records(world_id);
  CREATE INDEX IF NOT EXISTS idx_worlds_guild_id   ON world_records(guild_id);
  CREATE INDEX IF NOT EXISTS idx_worlds_created_at ON world_records(created_at);
  `,
  `
  CREATE TABLE IF NOT EXISTS deleted_world_records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id       TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    message_id     TEXT    NOT NULL,
    name           TEXT,
    author_name    TEXT,
    capacity       INTEGER,
    platforms      TEXT,
    tags           TEXT,
    image_url      TEXT,
    source_content TEXT,
    vrchat_data    TEXT,
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    deleted_at     INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_deleted_worlds_world_id ON deleted_world_records(world_id);
  CREATE INDEX IF NOT EXISTS idx_deleted_worlds_guild_id ON deleted_world_records(guild_id);
  `
];

/**
 * Run all pending migrations on the given database instance.
 * Migrations are idempotent (IF NOT EXISTS).
 */
export function runMigrations(db: Database.Database): void {
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migration = MIGRATIONS[i].trim();
    try {
      db.exec(migration);
      logger.info(`Migration ${i + 1}/${MIGRATIONS.length} applied`);
    } catch (error) {
      logger.error(`Migration ${i + 1} failed:`, error);
      throw error;
    }
  }
}
