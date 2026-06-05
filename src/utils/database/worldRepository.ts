import type Database from 'better-sqlite3';
import { getDatabase } from './index';
import logger from '../logger';

export interface WorldRecord {
  id?: number;
  worldId: string;
  guildId: string;
  messageId: string;
  name: string | null;
  authorName: string | null;
  capacity: number | null;
  platforms: string[];
  tags: string[];
  imageUrl: string | null;
  sourceContent: string | null;
  vrchatData: string | null;
  quality?: 'good' | 'bad' | null;
  createdAt?: number;
  updatedAt?: number;
}

function rowToRecord(row: Record<string, unknown>): WorldRecord {
  return {
    id: row.id as number,
    worldId: row.world_id as string,
    guildId: row.guild_id as string,
    messageId: row.message_id as string,
    name: row.name as string | null,
    authorName: row.author_name as string | null,
    capacity: row.capacity as number | null,
    platforms: safeJsonParse(row.platforms as string | null, []),
    tags: safeJsonParse(row.tags as string | null, []),
    imageUrl: row.image_url as string | null,
    sourceContent: row.source_content as string | null,
    vrchatData: row.vrchat_data as string | null,
    quality: (row.quality as 'good' | 'bad' | null) ?? null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number
  };
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class WorldRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDatabase();
  }

  /**
   * Upsert a world record. Preserves created_at and id on update;
   * updates all other fields and sets updated_at to now.
   */
  upsert(record: WorldRecord): void {
    const sql = `
      INSERT INTO world_records
        (world_id, guild_id, message_id, name, author_name, capacity,
         platforms, tags, image_url, source_content, vrchat_data, created_at, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, strftime('%s','now')), strftime('%s','now'))
      ON CONFLICT(world_id, guild_id) DO UPDATE SET
        name = excluded.name,
        author_name = excluded.author_name,
        capacity = excluded.capacity,
        platforms = excluded.platforms,
        tags = excluded.tags,
        image_url = excluded.image_url,
        source_content = excluded.source_content,
        vrchat_data = excluded.vrchat_data,
        updated_at = excluded.updated_at
    `;

    const stmt = this.db.prepare(sql);
    stmt.run(
      record.worldId,
      record.guildId,
      record.messageId,
      record.name,
      record.authorName,
      record.capacity,
      JSON.stringify(record.platforms),
      JSON.stringify(record.tags),
      record.imageUrl,
      record.sourceContent,
      record.vrchatData,
      record.createdAt ?? null
    );

    logger.debug(
      `Upserted world record ${record.worldId} in guild ${record.guildId}`
    );
  }

  /**
   * Get all guild-scoped records for a given world ID.
   */
  getByWorldId(worldId: string): WorldRecord[] {
    const sql =
      'SELECT * FROM world_records WHERE world_id = ? ORDER BY created_at DESC';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(worldId) as Record<string, unknown>[];
    return rows.map(rowToRecord);
  }

  /**
   * Get a specific world record by world ID + guild ID.
   */
  getByWorldAndGuild(
    worldId: string,
    guildId: string
  ): WorldRecord | undefined {
    const sql =
      'SELECT * FROM world_records WHERE world_id = ? AND guild_id = ? LIMIT 1';
    const stmt = this.db.prepare(sql);
    const row = stmt.get(worldId, guildId) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  /**
   * Move a world record to the deleted_world_records archive table,
   * then remove it from the live table. Returns true if a row existed.
   */
  deleteByWorldAndGuild(worldId: string, guildId: string): boolean {
    const archiveSql = `
      INSERT INTO deleted_world_records
        (world_id, guild_id, message_id, name, author_name, capacity, platforms, tags, image_url, source_content, vrchat_data, created_at, updated_at)
      SELECT world_id, guild_id, message_id, name, author_name, capacity, platforms, tags, image_url, source_content, vrchat_data, created_at, updated_at
      FROM world_records
      WHERE world_id = ? AND guild_id = ?
    `;
    const deleteSql =
      'DELETE FROM world_records WHERE world_id = ? AND guild_id = ?';

    const result = this.db.transaction(() => {
      const archiveStmt = this.db.prepare(archiveSql);
      archiveStmt.run(worldId, guildId);
      const deleteStmt = this.db.prepare(deleteSql);
      return deleteStmt.run(worldId, guildId);
    })();

    const didArchive = result.changes > 0;
    if (didArchive) {
      logger.info(
        `Archived world record ${worldId} from guild ${guildId} into deleted_world_records`
      );
    }
    return didArchive;
  }

  /**
   * Set the quality ('good' | 'bad') on a specific world record.
   * Preserves existing fields; only updates quality and updated_at.
   */
  updateQuality(
    worldId: string,
    guildId: string,
    quality: 'good' | 'bad'
  ): boolean {
    const sql = `
      UPDATE world_records
      SET quality = ?, updated_at = strftime('%s','now')
      WHERE world_id = ? AND guild_id = ?
    `;
    const stmt = this.db.prepare(sql);
    const result = stmt.run(quality, worldId, guildId);
    const didUpdate = result.changes > 0;
    if (didUpdate) {
      logger.info(
        `Set quality to "${quality}" for world ${worldId} in guild ${guildId}`
      );
    }
    return didUpdate;
  }

  /**
   * Paginated list of world records with optional filters.
   * @param limit   Max rows to return
   * @param offset  Rows to skip
   * @param filters Optional filters (tag array = AND logic, guildId)
   */
  getAllPaginated(
    limit: number,
    offset: number,
    filters?: { tags?: string[]; guildId?: string }
  ): { rows: WorldRecord[]; total: number } {
    const whereParts: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.guildId) {
      whereParts.push('guild_id = ?');
      params.push(filters.guildId);
    }

    if (filters?.tags && filters.tags.length > 0) {
      for (const tag of filters.tags) {
        whereParts.push(
          'EXISTS (SELECT 1 FROM json_each(tags) WHERE value = ?)'
        );
        params.push(tag);
      }
    }

    const whereClause =
      whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM world_records ${whereClause}`;
    const countStmt = this.db.prepare(countSql);
    const countRow = countStmt.get(...params) as { total: number } | undefined;
    const total = countRow?.total ?? 0;

    const selectSql = `SELECT * FROM world_records ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const selectStmt = this.db.prepare(selectSql);
    const rows = selectStmt.all(...params, limit, offset) as Record<
      string,
      unknown
    >[];

    return {
      rows: rows.map(rowToRecord),
      total
    };
  }

  /**
   * Get all unique tags across all world records, with occurrence counts.
   */
  getUniqueTags(): { tag: string; count: number }[] {
    const sql = `
      SELECT value as tag, COUNT(*) as count
      FROM world_records, json_each(tags)
      GROUP BY value
      ORDER BY count DESC
    `;
    const stmt = this.db.prepare(sql);
    return stmt.all() as { tag: string; count: number }[];
  }

  /**
   * Total number of world records.
   */
  count(): number {
    const sql = 'SELECT COUNT(*) as total FROM world_records';
    const stmt = this.db.prepare(sql);
    const row = stmt.get() as { total: number } | undefined;
    return row?.total ?? 0;
  }

  /**
   * The most recently processed world record.
   */
  getLastProcessed(): WorldRecord | undefined {
    const sql = 'SELECT * FROM world_records ORDER BY created_at DESC LIMIT 1';
    const stmt = this.db.prepare(sql);
    const row = stmt.get() as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }
}

// Singleton instance
let repoInstance: WorldRepository | null = null;

export function getWorldRepository(): WorldRepository {
  if (!repoInstance) {
    repoInstance = new WorldRepository();
  }
  return repoInstance;
}

/** Reset the singleton (useful in tests). */
export function resetWorldRepository(): void {
  repoInstance = null;
}
