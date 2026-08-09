import path from 'path';
import { getDatabase } from '../src/utils/database';
import { WorldRepository } from '../src/utils/database/worldRepository';
import Config from '../src/assets/config';

// Hard-coded canonical taxonomy (matches the bot's tagExtractor).
// Favored tags get a higher selection weight.
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
  'portal',
  'liminal'
];

const FAVORED_TAGS = new Set(['kino', 'chill', 'gamerip']);
const DEFAULT_TAG_BOOST = 3;

interface Args {
  dryRun: boolean;
  seed?: number;
  minTags: number;
  maxTags: number;
  tagBoost: number;
  qualityBias: number; // 0-1 probability of 'good'
  skipExisting: boolean;
}

function printUsage(): void {
  console.log(`
Usage: node dist/scripts/randomize-worlds-tags-and-quality.js [options]

Options:
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

function parseArgs(): Args {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const result: Args = {
    dryRun: args.includes('--dry-run'),
    minTags: 1,
    maxTags: 3,
    tagBoost: DEFAULT_TAG_BOOST,
    qualityBias: 0.5,
    skipExisting: args.includes('--skip-existing')
  };

  function readNumber(flag: string): number {
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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
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

// Deterministic PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandomTags(
  allTags: string[],
  count: number,
  rand: () => number,
  boost: number
): string[] {
  if (count <= 0) {
    return [];
  }
  if (count >= allTags.length) {
    return [...allTags];
  }

  const pool = allTags.map((tag) => ({
    tag,
    weight: FAVORED_TAGS.has(tag) ? boost : 1
  }));

  const picked: string[] = [];
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

function formatTags(tags: string[]): string {
  return tags.length === 0 ? '(none)' : tags.join(', ');
}

function main(): void {
  const args = parseArgs();
  const rand = args.seed !== undefined ? mulberry32(args.seed) : Math.random;

  const dbPath = path.resolve(Config.DATABASE_PATH);

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

  let db;
  try {
    db = getDatabase();
    db.exec('PRAGMA busy_timeout = 5000');
  } catch (error) {
    console.error(
      '❌ Failed to open database. Make sure the bot is not running and no other process has locked it.'
    );
    console.error(error);
    process.exit(1);
  }

  const repo = new WorldRepository(db);
  const { rows, total } = repo.getAllPaginated(Number.MAX_SAFE_INTEGER, 0);

  if (total === 0) {
    console.log('ℹ️  No world records found. Nothing to do.');
    db.close();
    process.exit(0);
  }

  console.log(`📦 Found ${total} world records\n`);

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
    const quality: 'good' | 'bad' = rand() < args.qualityBias ? 'good' : 'bad';

    if (args.dryRun) {
      console.log(
        `${prefix} Would update ${record.worldId} — tags: ${formatTags(tags)}, quality: ${quality}`
      );
      updatedTags++;
      updatedQuality++;
      continue;
    }

    const didUpdateTags = repo.updateTags(
      record.worldId,
      record.guildId,
      tags,
      record.sourceContent ?? null
    );
    const didUpdateQuality = repo.updateQuality(
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
