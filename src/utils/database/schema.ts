import type Database from 'better-sqlite3';
import logger from '../logger';

interface Migration {
  name: string;
  run: (db: Database.Database) => void;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_create_world_records',
    run: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS world_records (
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
          created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
          updated_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),

          UNIQUE(world_id, guild_id)
        );

        CREATE INDEX IF NOT EXISTS idx_worlds_world_id   ON world_records(world_id);
        CREATE INDEX IF NOT EXISTS idx_worlds_guild_id   ON world_records(guild_id);
        CREATE INDEX IF NOT EXISTS idx_worlds_created_at ON world_records(created_at);
      `);
    }
  },
  {
    name: '002_create_deleted_world_records',
    run: (db) => {
      db.exec(`
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
      `);
    }
  },
  {
    name: '003_add_quality_column',
    run: (db) => {
      const columns = db
        .prepare('PRAGMA table_info(world_records)')
        .all() as Array<{ name: string }>;
      if (!columns.some((c) => c.name === 'quality')) {
        db.exec(
          `ALTER TABLE world_records ADD COLUMN quality TEXT CHECK(quality IN ('good', 'bad'))`
        );
      }
    }
  },
  {
    name: '004_add_capacity_index',
    run: (db) => {
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_worlds_capacity ON world_records(capacity)`
      );
    }
  },
  {
    name: '005_add_internal_add_date_column',
    run: (db) => {
      const needsColumn = (table: string) => {
        const columns = db
          .prepare(`PRAGMA table_info(${table})`)
          .all() as Array<{ name: string }>;
        return !columns.some((c) => c.name === 'internal_add_date');
      };

      if (needsColumn('world_records')) {
        db.exec(
          `ALTER TABLE world_records ADD COLUMN internal_add_date INTEGER`
        );
      }

      if (needsColumn('deleted_world_records')) {
        db.exec(
          `ALTER TABLE deleted_world_records ADD COLUMN internal_add_date INTEGER`
        );
      }
    }
  }
];

/**
 * Run all pending migrations on the given database instance.
 * Tracks applied migrations in _migrations so each runs only once.
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )`);

  const appliedNames = new Set<string>(
    (
      db.prepare('SELECT name FROM _migrations').all() as Array<{
        name: string;
      }>
    ).map((r) => r.name)
  );

  for (let i = 0; i < MIGRATIONS.length; i++) {
    const migration = MIGRATIONS[i];
    if (appliedNames.has(migration.name)) {
      logger.debug(`Migration ${migration.name} already applied — skipping`);
      continue;
    }

    try {
      db.transaction(() => {
        migration.run(db);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(
          migration.name
        );
      })();
      logger.info(
        `Migration ${i + 1}/${MIGRATIONS.length} applied: ${migration.name}`
      );
    } catch (error) {
      logger.error(`Migration ${migration.name} failed:`, error);
      throw error;
    }
  }
}
