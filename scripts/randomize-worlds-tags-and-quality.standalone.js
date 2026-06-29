#!/usr/bin/env node
/* eslint-disable */
/**
 * Standalone, portable script for randomly assigning canonical tags and
 * good/bad quality ratings to every row in a bot_vrc_world_tagger worlds.db.
 *
 * Dependencies: better-sqlite3 (and optionally dotenv if you want .env support).
 *
 * Copy this single file to the target environment and run:
 *   node randomize-worlds-tags-and-quality.standalone.js [options]
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Hard-coded canonical taxonomy (matches the bot's tagExtractor).
// Favored tags get a higher selection weight.
// ---------------------------------------------------------------------------
const ALL_TAGS = [
  'kino',
  'chill',
  'comfy',
  'adventure',
  'horror',
  'game',
  'particle live / vrmv',
  'gallery',
  'meme',
  'puzzle',
  'driving',
  'tech',
  'nature',
  'gamerip',
  'portal'
];

const FAVORED_TAGS = new Set(['kino', 'chill', 'gamerip']);
const DEFAULT_TAG_BOOST = 3; // favored tags are 3x as likely to be picked

// ---------------------------------------------------------------------------
// Optional .env loading. Falls back gracefully if dotenv is not installed.
// ---------------------------------------------------------------------------
try {
  require('dotenv').config();
} catch {
  // dotenv is optional; ignore if missing.
}

const Database = require('better-sqlite3');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function printUsage() {
  console.log(`
Usage: node randomize-worlds-tags-and-quality.standalone.js [options]

Options:
  --db <path>            Path to the SQLite database (default: ./worlds.db or DATABASE_PATH)
  --dry-run              Preview changes without writing to the database
  --seed <number>        Seed the random generator for reproducible results
  --min-tags <number>    Minimum tags per world (default: 1)
  --max-tags <number>    Maximum tags per world (default: 3)
  --tag-boost <number>   Weight multiplier for favored tags: kino, chill, gamerip (default: 3)
  --quality-bias <0-1>   Probability of assigning 'good' vs 'bad' (default: 0.5)
  --skip-existing        Skip records that already have tags or quality set
  --help                 Show this help message
`);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const result = {
    dbPath: null,
    dryRun: args.includes('--dry-run'),
    seed: undefined,
    minTags: 1,
    maxTags: 3,
    tagBoost: DEFAULT_TAG_BOOST,
    qualityBias: 0.5,
    skipExisting: args.includes('--skip-existing')
  };

  function readNumber(flag) {
    const index = args.indexOf(flag);
    if (index === -1 || index + 1 >= args.length) {
      console.error(`❌ ${flag} requires a numeric value`);
      process.exit(1);
    }
    const value = Number(args[index + 1]);
    if (!Number.isFinite(value)) {
      console.error(`❌ ${flag} must be a valid number`);
      process.exit(1);
    }
    return value;
  }

  function readString(flag) {
    const index = args.indexOf(flag);
    if (index === -1 || index + 1 >= args.length) {
      console.error(`❌ ${flag} requires a value`);
      process.exit(1);
    }
    return args[index + 1];
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--db':
        result.dbPath = readString('--db');
        break;
      case '--seed':
        result.seed = readNumber('--seed');
        break;
      case '--min-tags':
        result.minTags = readNumber('--min-tags');
        break;
      case '--max-tags':
        result.maxTags = readNumber('--max-tags');
        break;
      case '--tag-boost':
        result.tagBoost = readNumber('--tag-boost');
        break;
      case '--quality-bias':
        result.qualityBias = readNumber('--quality-bias');
        break;
    }
  }

  if (result.minTags < 0 || result.maxTags < 0) {
    console.error('❌ Tag counts cannot be negative');
    process.exit(1);
  }

  if (result.minTags > result.maxTags) {
    console.error('❌ --min-tags cannot be greater than --max-tags');
    process.exit(1);
  }

  if (result.qualityBias < 0 || result.qualityBias > 1) {
    console.error('❌ --quality-bias must be between 0 and 1');
    process.exit(1);
  }

  if (result.tagBoost < 0) {
    console.error('❌ --tag-boost cannot be negative');
    process.exit(1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32).
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandomTags(allTags, count, rand, boost) {
  if (count <= 0) {
    return [];
  }
  if (count >= allTags.length) {
    return [...allTags];
  }

  // Build a weighted pool: favored tags get `boost` times the weight of others.
  const pool = allTags.map((tag) => ({
    tag,
    weight: FAVORED_TAGS.has(tag) ? boost : 1
  }));

  const picked = [];
  for (let n = 0; n < count; n++) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let threshold = rand() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
      threshold -= pool[i].weight;
      if (threshold <= 0) {
        picked.push(pool[i].tag);
        pool.splice(i, 1);
        break;
      }
    }
  }

  // Return in canonical order for stable output.
  return picked.sort((a, b) => allTags.indexOf(a) - allTags.indexOf(b));
}

function formatTags(tags) {
  return tags.length === 0 ? '(none)' : tags.join(', ');
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Database helpers (mirror the repository logic so we stay self-contained).
// ---------------------------------------------------------------------------
function applyMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  const migrations = [
    {
      name: '001_create_world_records',
      sql: `
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
      `
    },
    {
      name: '002_create_deleted_world_records',
      sql: `
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
    },
    {
      name: '003_add_quality_column',
      sql: `
        ALTER TABLE world_records ADD COLUMN quality TEXT CHECK(quality IN ('good', 'bad'))
      `,
      guard: (db) => {
        const columns = db.prepare('PRAGMA table_info(world_records)').all();
        return !columns.some((c) => c.name === 'quality');
      }
    }
  ];

  const appliedNames = new Set(
    db.prepare('SELECT name FROM _migrations').all().map((r) => r.name)
  );

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) continue;
    if (migration.guard && !migration.guard(db)) {
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
      continue;
    }
    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(migration.name);
    })();
    console.log(`🔧 Applied migration: ${migration.name}`);
  }
}

function getAllRecords(db) {
  const stmt = db.prepare('SELECT * FROM world_records ORDER BY created_at DESC');
  return stmt.all().map((row) => ({
    worldId: row.world_id,
    guildId: row.guild_id,
    messageId: row.message_id,
    name: row.name ?? null,
    authorName: row.author_name ?? null,
    capacity: row.capacity ?? null,
    platforms: safeJsonParse(row.platforms, []),
    tags: safeJsonParse(row.tags, []),
    imageUrl: row.image_url ?? null,
    sourceContent: row.source_content ?? null,
    vrchatData: row.vrchat_data ?? null,
    quality: row.quality ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

function updateTags(db, worldId, guildId, tags, sourceContent) {
  const existing = db
    .prepare('SELECT tags, source_content FROM world_records WHERE world_id = ? AND guild_id = ? LIMIT 1')
    .get(worldId, guildId);
  if (!existing) return false;

  const tagsChanged = JSON.stringify(safeJsonParse(existing.tags, [])) !== JSON.stringify(tags);
  const sourceChanged = existing.source_content !== sourceContent;
  if (!tagsChanged && !sourceChanged) return false;

  const result = db
    .prepare(
      'UPDATE world_records SET tags = ?, source_content = ?, updated_at = strftime(\'%s\',\'now\') WHERE world_id = ? AND guild_id = ?'
    )
    .run(JSON.stringify(tags), sourceContent, worldId, guildId);
  return result.changes > 0;
}

function updateQuality(db, worldId, guildId, quality) {
  const existing = db
    .prepare('SELECT quality FROM world_records WHERE world_id = ? AND guild_id = ? LIMIT 1')
    .get(worldId, guildId);
  if (!existing) return false;
  if (existing.quality === quality) return false;

  const result = db
    .prepare(
      'UPDATE world_records SET quality = ?, updated_at = strftime(\'%s\',\'now\') WHERE world_id = ? AND guild_id = ?'
    )
    .run(quality, worldId, guildId);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const args = parseArgs();
  const rand = args.seed !== undefined ? mulberry32(args.seed) : Math.random;

  const dbPath = path.resolve(args.dbPath || process.env.DATABASE_PATH || './worlds.db');

  console.log(
    `🎲 Randomizing world tags & quality${args.dryRun ? ' (DRY RUN)' : ''}`
  );
  console.log(`📂 Database: ${dbPath}`);
  if (args.seed !== undefined) {
    console.log(`🌱 Seed: ${args.seed}`);
  }
  console.log(
    `🏷️  Tags per world: ${args.minTags}-${args.maxTags} from ${ALL_TAGS.length} canonical tags (favored: ${Array.from(FAVORED_TAGS).join(', ')}, boost: ${args.tagBoost}x)`
  );
  console.log(`⭐ Quality bias: ${(args.qualityBias * 100).toFixed(0)}% good`);
  if (args.skipExisting) {
    console.log(`⏭️  Skipping records that already have tags or quality`);
  }
  console.log('');

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found: ${dbPath}`);
    process.exit(1);
  }

  let db;
  try {
    db = new Database(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    applyMigrations(db);
  } catch (error) {
    console.error(
      '❌ Failed to open database. Make sure the bot is not running and no other process has locked it.'
    );
    console.error(error);
    process.exit(1);
  }

  const rows = getAllRecords(db);

  if (rows.length === 0) {
    console.log('ℹ️  No world records found. Nothing to do.');
    db.close();
    process.exit(0);
  }

  console.log(`📦 Found ${rows.length} world records\n`);

  if (!args.dryRun) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}.randomize-backup-${timestamp}.db`;
    try {
      db.exec(`VACUUM INTO '${backupPath}'`);
      console.log(`📁 Backed up database → ${backupPath}\n`);
    } catch (error) {
      console.error('❌ Failed to create backup:', error);
      db.close();
      process.exit(1);
    }
  }

  let updatedTags = 0;
  let updatedQuality = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i++) {
    const record = rows[i];
    const prefix = `[${i + 1}/${rows.length}]`;

    const hasExisting =
      (record.tags?.length ?? 0) > 0 || record.quality !== null;

    if (args.skipExisting && hasExisting) {
      console.log(
        `${prefix} ⏭️  ${record.worldId} — skipped (already has tags/quality)`
      );
      skipped++;
      continue;
    }

    const tagCount =
      args.minTags + Math.floor(rand() * (args.maxTags - args.minTags + 1));
    const tags = pickRandomTags(ALL_TAGS, tagCount, rand, args.tagBoost);
    const quality = rand() < args.qualityBias ? 'good' : 'bad';

    if (args.dryRun) {
      console.log(
        `${prefix} Would update ${record.worldId} — tags: ${formatTags(tags)}, quality: ${quality}`
      );
      updatedTags++;
      updatedQuality++;
      continue;
    }

    const didUpdateTags = updateTags(
      db,
      record.worldId,
      record.guildId,
      tags,
      record.sourceContent
    );
    const didUpdateQuality = updateQuality(
      db,
      record.worldId,
      record.guildId,
      quality
    );

    if (didUpdateTags) updatedTags++;
    if (didUpdateQuality) updatedQuality++;

    console.log(
      `${prefix} ${record.worldId} — tags: ${formatTags(tags)}, quality: ${quality}`
    );
  }

  console.log('\n═══════════════════════════════════════');
  console.log('      Randomization Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Total records:    ${rows.length}`);
  console.log(`Tag updates:      ${updatedTags}`);
  console.log(`Quality updates:  ${updatedQuality}`);
  console.log(`Skipped:          ${skipped}`);

  if (args.dryRun) {
    console.log('\n🏃 This was a dry run. No changes were written.');
    console.log(
      '   Run without --dry-run to apply random tags and quality ratings.'
    );
  }

  db.close();
  process.exit(0);
}

main();
