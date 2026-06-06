import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs';
import path from 'path';
import { getDatabase } from '../src/utils/database';
import { WorldRepository } from '../src/utils/database/worldRepository';
import { runMigrations } from '../src/utils/database/schema';
import { fetchWorldData } from '../src/events/messageCreate/watchForVRCWorldLinks/worldData';
import { getSupportedPlatforms } from '../src/utils/helpers';
import logger from '../src/utils/logger';

const safeJsonStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, val) =>
    typeof val === 'bigint' ? val.toString() : val
  );

interface MigrationSummary {
  total: number;
  succeeded: number;
  failed: number;
  notFound: number;
  dryRun: boolean;
}

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run')
  };
}

function readDbJson(): Record<string, string> {
  const dbJsonPath = path.join(process.cwd(), 'db.json');

  if (!fs.existsSync(dbJsonPath)) {
    console.error('❌ db.json not found at', dbJsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dbJsonPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const cache = parsed.cache as Array<[string, { value: unknown }]>;

  const entry = cache.find(
    ([key]) => key === 'PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID'
  );

  if (!entry) {
    console.error(
      '❌ PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID not found in db.json'
    );
    process.exit(1);
  }

  return entry[1].value as Record<string, string>;
}

function parseCompositeKey(compositeKey: string): {
  worldId: string;
  guildId: string;
} {
  const lastDash = compositeKey.lastIndexOf('-');
  if (lastDash === -1) {
    throw new Error(`Invalid composite key: ${compositeKey}`);
  }
  return {
    worldId: compositeKey.slice(0, lastDash),
    guildId: compositeKey.slice(lastDash + 1)
  };
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs();
  const worldKvp = readDbJson();
  const entries = Object.entries(worldKvp);

  console.log(`🔧 V1 → V2 Migration${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`📦 Found ${entries.length} world records in db.json\n`);

  if (entries.length === 0) {
    console.log('Nothing to migrate.');
    process.exit(0);
  }

  // Ensure database is initialized
  const db = getDatabase();
  runMigrations(db);
  const repo = new WorldRepository(db);

  const summary: MigrationSummary = {
    total: entries.length,
    succeeded: 0,
    failed: 0,
    notFound: 0,
    dryRun
  };

  for (let i = 0; i < entries.length; i++) {
    const [compositeKey, messageId] = entries[i];
    const { worldId, guildId } = parseCompositeKey(compositeKey);

    const prefix = `[${i + 1}/${entries.length}]`;

    if (dryRun) {
      console.log(`${prefix} Would migrate ${worldId} (guild ${guildId})`);
      summary.succeeded++;
      continue;
    }

    try {
      const worldData = await fetchWorldData(worldId);

      if (!worldData || !worldData.id) {
        summary.notFound++;
        console.warn(`${prefix} ⚠️  ${worldId} — not found or inaccessible`);
        continue;
      }

      const record = {
        worldId,
        guildId,
        messageId,
        name: worldData.name ?? null,
        authorName: worldData.authorName ?? null,
        capacity: worldData.capacity ?? null,
        platforms: getSupportedPlatforms(worldData.unityPackages),
        tags: [],
        imageUrl: worldData.imageUrl ?? null,
        sourceContent: null,
        vrchatData: safeJsonStringify(worldData)
      };

      repo.upsert(record);
      summary.succeeded++;
      console.log(
        `${prefix} ✅ ${worldId} — ${worldData.name ?? 'unknown'} (${worldData.authorName ?? 'unknown author'})`
      );
    } catch (error: unknown) {
      const err = error as Error & {
        status?: number;
        response?: { status?: number };
      };
      const status = err.status ?? err.response?.status;

      if (status === 404) {
        summary.notFound++;
        console.warn(`${prefix} ⚠️  ${worldId} — not found (404)`);
      } else {
        summary.failed++;
        console.error(
          `${prefix} ❌ ${worldId} — ${err.message ?? 'Unknown error'}`
        );
        logger.error(`Migration failed for ${worldId}:`, err);
      }
    }

    // Rate-limiting: 200ms delay between API calls
    if (i < entries.length - 1) {
      await sleep(200);
    }
  }

  // Print summary
  console.log('\n═══════════════════════════════════════');
  console.log('         Migration Summary');
  console.log('═══════════════════════════════════════');
  console.log(`Total records:    ${summary.total}`);
  console.log(`Succeeded:        ${summary.succeeded}`);
  console.log(`Failed (API err): ${summary.failed}`);
  console.log(`Not found (404):  ${summary.notFound}`);

  if (dryRun) {
    console.log('\n🏃 This was a dry run. No changes were written.');
    console.log('   Run without --dry-run to execute the migration.');
  } else {
    console.log('\n✅ Migration complete.');

    // Rename db.json if all records were processed
    const dbJsonPath = path.join(process.cwd(), 'db.json');
    const backupPath = `${dbJsonPath}.v1-migrated`;

    if (summary.failed === 0) {
      fs.renameSync(dbJsonPath, backupPath);
      console.log(`📁 Renamed db.json → ${path.basename(backupPath)}`);
    } else {
      console.log(
        `⚠️  db.json NOT renamed because ${summary.failed} record(s) had unexpected API errors.`
      );
      console.log(
        '   Fix the issues and re-run, or rename manually when ready.'
      );
    }
  }

  db.close();
  process.exit(0);
}

main().catch((error) => {
  console.error('Migration script crashed:', error);
  process.exit(1);
});
