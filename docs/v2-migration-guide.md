# V1 → V2 Migration Guide

## Overview

This guide walks through migrating your bot from the flat `db.json` key-value storage (V1) to the structured SQLite metadata database (V2).

**Prerequisites:**
- V2 code deployed (branch `refactor/sql-integration` or later)
- `.env` configured with `DATABASE_PATH`, `BOT_TOKEN`, `VRC_USERNAME`, `VRC_PASSWORD`, `VRC_TOTP_KEY`
- `pnpm install` complete (includes `better-sqlite3`)

---

## Step 1: Run the Migration Script

The migration script reads `PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID` from `db.json` and re-hydrates each world via the VRChat API.

### 1.1 Dry run (recommended first)

```bash
npx jiti scripts/migrate-v1-to-v2.ts --dry-run
```

**What it does:**
- Counts how many records are in `db.json`
- Prints a preview of what would be migrated
- **Does NOT** call the VRChat API or write to SQLite

**Expected output:**
```
🔧 V1 → V2 Migration (DRY RUN)
📦 Found 95 world records in db.json
[1/95] Would migrate wrld_xxx (guild yyy)
...
═══════════════════════════════════════
         Migration Summary
═══════════════════════════════════════
Total records:    95
Succeeded:        95
Failed (API err): 0
Not found (404):  0
🏃 This was a dry run. No changes were written.
```

### 1.2 Execute the migration

```bash
npx jiti scripts/migrate-v1-to-v2.ts
```

**What it does:**
- Fetches VRChat API data for each world (200ms delay between calls)
- Inserts/upserts rows into `worlds.db`
- Sets `internal_add_date` on each row from the original Discord message ID timestamp
- Prints per-world progress with world name and author
- On full success, renames `db.json → db.json.v1-migrated`

**Sample output:**
```
[1/95] ✅ wrld_36c958b1... — INABACITY （2024） (satius)
[2/95] ✅ wrld_c701e46f... — Bag End (Duznot)
...
═══════════════════════════════════════
         Migration Summary
═══════════════════════════════════════
Total records:    95
Succeeded:        89
Failed (API err): 0
Not found (404):  6
✅ Migration complete.
📁 Copied db.json → db.json.v1-migrated (backup)
ℹ️  db.json left in place — it contains active bot config.
   When you're confident the migration is stable, you can
   manually delete these two keys from db.json:
   • PROCESSED_WORLDS
   • PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID
```

**Notes:**
- Worlds deleted or made private will show "⚠️ not found or inaccessible" — this is expected
- The script is **idempotent** — re-running it just overwrites existing rows
- `internal_add_date` is derived from each saved Discord message ID, so re-running will not overwrite an already-populated date
- `db.json` is **copied** (not renamed) to `db.json.v1-migrated` so your active config stays intact
- **Do not delete `db.json`** — it still holds all channel/watch/react configuration

---

## Step 2: Rebuild Tags & Source Content

After migration, all rows have `tags = []` and `sourceContent = null` because the script does not fetch historical Discord messages. Use the crawl command to backfill these from your watched channels.

### 2.1 Identify your watched channels

Run `.stats` in Discord to see which channels are being watched.

### 2.2 Run tag rebuild per channel

For each watched channel that contains original world posts (with tweet text / tags):

```
.crawlHistory #original-posts-channel --tags
```

**What it does:**
- Scans all messages in the channel
- Resolves Twitter links to fetch tweet content
- Runs the tag extractor on the source text
- Updates `tags` and `source_content` in SQLite
- Backfills `internal_add_date` for existing worlds from each message's timestamp

**Progress updates every 25 messages:**
```
🔄 **Tag Rebuild in Progress**
📺 Channel: #original-posts-channel
📊 Messages Processed: 1,250
✅ Records Updated: 87
⚠️ Not Found: 3
```

**Notes:**
- "Not Found" means the world isn't in the database (e.g., posted after migration or deleted) — this is safe to ignore
- Re-running is safe — it just re-extracts and overwrites tags/source content
- Any worlds that were migrated without an `internal_add_date` will have it filled from the original message timestamp
- Channels must **not** be watched to run `--tags` mode (restriction removed for backfill)

---

## Step 3: Assign Quality (Good / Bad)

If you have channels where forwards are tagged as "good" or "bad" maps, use the quality crawl to retroactively mark them.

### 3.1 Configure quality channels (if not already done)

```
.setQualityChannel good #good-maps-channel
.setQualityChannel bad #bad-maps-channel
```

### 3.2 Run quality assignment per channel

For your **good** channel:
```
.crawlHistory #good-maps-channel --quality good
```

For your **bad** channel:
```
.crawlHistory #bad-maps-channel --quality bad
```

**What it does:**
- Scans all messages in the channel
- Extracts world IDs from:
  - Raw message content
  - Bot embed URLs/descriptions
  - **Discord native forwarded message snapshots** (the `messageSnapshots` API)
- Calls `repo.updateQuality()` for each found world
- Backfills `internal_add_date` for existing worlds from each message's timestamp

**Progress updates:**
```
🔄 **Quality Assignment (good) in Progress**
📺 Channel: #good-maps-channel
📊 Messages Processed: 500
✅ Records Updated: 47
⚠️ Not Found: 2
```

**Notes:**
- Only the **first** world ID per message is counted
- Worlds not in the database are skipped with a logged warning
- Re-running is idempotent — same quality will be re-applied
- Existing worlds will have `internal_add_date` backfilled from the message timestamp

---

## Step 4: Verify the Migration

### 4.1 Check row count

```bash
sqlite3 worlds.db "SELECT COUNT(*) FROM world_records;"
```

### 4.2 Check a sample row

```bash
sqlite3 worlds.db "SELECT world_id, name, author_name, tags, quality, internal_add_date FROM world_records LIMIT 5;"
```

`internal_add_date` should be a Unix timestamp matching when the world was originally posted on Discord.

### 4.3 Check tag distribution

```bash
sqlite3 worlds.db "SELECT value as tag, COUNT(*) as count FROM world_records, json_each(tags) GROUP BY value ORDER BY count DESC;"
```

### 4.4 Check quality counts

```bash
sqlite3 worlds.db "SELECT quality, COUNT(*) FROM world_records WHERE quality IS NOT NULL GROUP BY quality;"
```

### 4.5 Bot health check

Start the bot and run:
```
.stats
```

You should see:
- Total live world count (from SQLite)
- Last processed world as a named VRChat link
- Top 5 tags by frequency

---

## Step 5: Clean Up (After Confirming Everything Works)

### 5.1 ⚠️ Remove specific keys inside db.json — do NOT delete the file

**Never delete `db.json` entirely.** It contains all your active bot configuration (watched channels, forwarding mappings, ignored users, etc.).

Only these **two keys inside** `db.json` are obsolete after migration:

- `PROCESSED_WORLDS`
- `PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID`

You can remove them automatically with the cleanup script:

```bash
npx jiti scripts/cleanup-db-json.ts --dry-run   # preview
npx jiti scripts/cleanup-db-json.ts             # execute
```

**What the script does:**
- Backs up `db.json → db.json.pre-cleanup`
- Removes the two obsolete keys
- Leaves all other config intact
- Prints which keys were removed and their byte sizes

**Or do it manually** by editing `db.json` and deleting the two entries from the `cache` array.

**Keys you must keep in db.json:**
- `WATCHED_CHANNELS`
- `WATCHED_REACTION_CHANNELS`
- `REACTION_FORWARD_CHANNELS`
- `REACTION_FORWARDED_MESSAGE_IDS`
- `FORCE_REFETCHED_MESSAGE_IDS`
- `ANDROID_FORWARDING_CHANNEL`
- `PLAYER_COUNT_FORWARDING_CHANNEL`
- `LOW_CAPACITY_FORWARDING_CHANNEL`
- `QUALITY_GOOD_FORWARDING_CHANNEL`
- `QUALITY_BAD_FORWARDING_CHANNEL`
- `REACT_TO_DELETE_EMOJIS`
- `IGNORED_USERS`
- `CHANNEL_HISTORY_CRAWL_STATUS`

### 5.2 Verify API is running

```bash
curl http://localhost:3000/api/health
```

Expected:
```json
{"status":"ok","worldCount":89,"dbVersion":1}
```

### 5.3 Test API auth

```bash
curl -H "Authorization: Bearer YOUR_API_TOKEN" http://localhost:3000/api/worlds?limit=1
```

---

## Troubleshooting

### Script crashes with "db.json not found"
Ensure `db.json` is in the project root (same directory as `package.json`).

### VRChat API rate limiting
The script has a built-in 200ms delay. If you hit rate limits, increase it in `scripts/migrate-v1-to-v2.ts`:
```ts
await sleep(500); // change from 200 to 500
```

### "not found or inaccessible" worlds
These are worlds that were deleted, made private, or removed from VRChat. They are skipped intentionally. You can verify by checking the world ID manually:
```bash
node -e "const {vrchat} = require('./dist/utils/externalApi/vrchat'); vrchat.getWorld({client: vrchat.client, path: {worldId: 'WRID_HERE'}}).then(r => console.log(r.data?.name)).catch(e => console.log(e.status))"
```

### Tags mode finds 0 records updated
Make sure the channel you're crawling actually contains the **original** posts with tweet text / world URLs. If the channel only contains bot embeds, the tag extractor won't find any raw text to parse. Crawl the source channel instead.

### Quality mode finds 0 records updated
Make sure the world IDs in the channel are already in `worlds.db`. If a world was never processed by the bot (e.g., manually forwarded), it won't exist in the database. Quality assignment only updates existing rows.

---

## Summary Checklist

- [ ] Run `npx jiti scripts/migrate-v1-to-v2.ts --dry-run`
- [ ] Run `npx jiti scripts/migrate-v1-to-v2.ts`
- [ ] Verify `worlds.db` has expected row count
- [ ] Verify `internal_add_date` is populated for migrated worlds
- [ ] Run `.crawlHistory #channel --tags` for each watched channel with original posts
- [ ] Run `.crawlHistory #good-channel --quality good`
- [ ] Run `.crawlHistory #bad-channel --quality bad`
- [ ] Run `.stats` to confirm data looks correct
- [ ] Test `curl /api/health` and `/api/worlds`
- [ ] (Optional) Remove obsolete world keys from `db.json` via `npx jiti scripts/cleanup-db-json.ts` **(do NOT delete the file itself)**
- [ ] Start the bot normally

**End of guide.**
