import Database from 'better-sqlite3';
import path from 'path';
import Config from '../../assets/config';
import logger from '../logger';
import { runMigrations } from './schema';

let dbInstance: Database.Database | null = null;

/**
 * Get or create the singleton SQLite database instance.
 * Migrations are applied automatically on first access.
 */
export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = path.resolve(Config.DATABASE_PATH);
  logger.info(`Opening SQLite database at ${dbPath}`);

  dbInstance = new Database(dbPath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');

  runMigrations(dbInstance);

  return dbInstance;
}

/**
 * Close the database connection. Useful for graceful shutdown or tests.
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('SQLite database connection closed');
  }
}
