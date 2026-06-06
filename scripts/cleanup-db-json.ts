import fs from 'fs';
import path from 'path';

const OBSOLETE_KEYS = [
  'PROCESSED_WORLDS',
  'PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID'
];

interface DbJson {
  cache: Array<[string, { value: unknown }]>;
  lastExpire: number;
}

function parseArgs(): { dryRun: boolean } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run')
  };
}

function readDbJson(): DbJson {
  const dbJsonPath = path.join(process.cwd(), 'db.json');

  if (!fs.existsSync(dbJsonPath)) {
    console.error('❌ db.json not found at', dbJsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(dbJsonPath, 'utf-8');
  return JSON.parse(raw) as DbJson;
}

function main(): void {
  const { dryRun } = parseArgs();

  const dbJsonPath = path.join(process.cwd(), 'db.json');
  const data = readDbJson();

  const originalCount = data.cache.length;

  // Find obsolete entries
  const obsoleteEntries = data.cache.filter(([key]) =>
    OBSOLETE_KEYS.includes(key)
  );

  if (obsoleteEntries.length === 0) {
    console.log('✅ No obsolete keys found in db.json. Nothing to clean.');
    process.exit(0);
  }

  console.log(`🧹 db.json cleanup${dryRun ? ' (DRY RUN)' : ''}`);
  console.log(`📦 Found ${originalCount} entries in db.json`);
  console.log(`🔍 Found ${obsoleteEntries.length} obsolete key(s):`);
  for (const [key, val] of obsoleteEntries) {
    const valueSize = JSON.stringify(val).length;
    console.log(`   • ${key} (${valueSize.toLocaleString()} bytes)`);
  }

  if (dryRun) {
    console.log('\n🏃 This was a dry run. No changes were written.');
    console.log('   Run without --dry-run to remove the obsolete keys.');
    process.exit(0);
  }

  // Create backup before modifying
  const backupPath = `${dbJsonPath}.pre-cleanup`;
  fs.copyFileSync(dbJsonPath, backupPath);
  console.log(`\n📁 Backed up db.json → ${path.basename(backupPath)}`);

  // Filter out obsolete keys
  const cleanedCache = data.cache.filter(
    ([key]) => !OBSOLETE_KEYS.includes(key)
  );

  const cleanedData: DbJson = {
    ...data,
    cache: cleanedCache
  };

  fs.writeFileSync(dbJsonPath, JSON.stringify(cleanedData, null, 2));

  const removedCount = originalCount - cleanedCache.length;
  console.log(`✅ Removed ${removedCount} obsolete key(s).`);
  console.log(`📊 db.json now has ${cleanedCache.length} entries.`);
  console.log(
    `\nℹ️  If something goes wrong, restore from: ${path.basename(backupPath)}`
  );
}

main();
