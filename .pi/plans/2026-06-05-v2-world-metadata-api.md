# V2 Plan: Structured World Metadata + Fastify API

> **Status:** Phases 1–4 complete. Phases 5–6 pending.
> **Branch:** `refactor/sql-integration`

---

## 1. Problem Statement

The bot currently stores discovered VRChat worlds as minimal, flat key–value pairs:

- `PROCESSED_WORLDS`: `string[]` of world IDs
- `PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID`: `Record<"${worldId}-${guildId}", messageId>`

This means **tags, capacity, author, name, platforms, and tweet source text are all discarded** after the initial Discord embed is sent. The only way to recover them is to re-query the VRChat API or re-read the original Discord message.

Additionally, the existing read-only HTTP export (`/api/worlds`) is built on Node's raw `http` module and returns only `id`, `vrchatUrl`, and `messageId`. There is no way to search, filter, or browse by tag.

**Goal:** Upgrade the storage layer to structured metadata records and expose a richer, queryable Fastify API so external consumers (e.g., a GitHub Pages "World Explorer") can browse worlds by tag, capacity, and other metadata.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Discord Bot (discord.js)                                   │
│  ├── Message flow: watchForVRCWorldLinks                     │
│  │   └── extract tags + fetch VRC API → SQLite upsert        │
│  ├── Reactions: undo, refetch, forward                      │
│  │   └── read/write SQLite world records                      │
│  └── Commands: .stats, .export, .remove                     │
│      └── query SQLite instead of JSON KVP                     │
├─────────────────────────────────────────────────────────────┤
│  Fastify API Server (read-only, same process)               │
│  ├── GET /api/health                                         │
│  ├── GET /api/worlds    ?tag=horror&limit=50&offset=0        │
│  ├── GET /api/worlds/:worldId                                │
│  └── GET /api/tags                                           │
├─────────────────────────────────────────────────────────────┤
│  SQLite (worlds.db)                                          │
│  └── world_records table                                     │
│  Created lazily on first getDatabase() call, or eagerly    │
│  on bot startup (ClientReady) if we choose to add it.        │
├─────────────────────────────────────────────────────────────┤
│  keyv-file (db.json) — retained for non-world config         │
│  ├── WATCHED_CHANNELS, WATCHED_REACTION_CHANNELS             │
│  ├── REACTION_FORWARD_CHANNELS, REACTION_FORWARDED_MESSAGE_IDS│
│  ├── IGNORED_USERS, FORCE_REFETCHED_MESSAGE_IDS, etc.        │
└─────────────────────────────────────────────────────────────┘
```

**Principles:**
- SQLite is **only** for world metadata. All guild/channel/reaction/user config stays in `keyv-file`.
- The API is **read-only**; all input remains via the Discord bot.
- Backwards compatibility is **not** required in code. V1 will run separately until migration is done.
- After migration, `db.json`'s world keys become obsolete and can be removed.

---

## 3. SQLite Schema

```sql
-- World metadata table
CREATE TABLE IF NOT EXISTS world_records (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    world_id       TEXT    NOT NULL,
    guild_id       TEXT    NOT NULL,
    message_id     TEXT    NOT NULL,
    name           TEXT,
    author_name    TEXT,
    capacity       INTEGER,
    platforms      TEXT,   -- JSON array, e.g. '["standalonewindows","android"]'
    tags           TEXT,   -- JSON array, e.g. '["horror","game"]'
    image_url      TEXT,
    source_content TEXT,   -- Original message / tweet text
    vrchat_data    TEXT,   -- Full VRChat API response as JSON blob
    created_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at     INTEGER NOT NULL DEFAULT (strftime('%s','now')),

    UNIQUE(world_id, guild_id)
);

-- Indexes for API query patterns
CREATE INDEX IF NOT EXISTS idx_worlds_world_id   ON world_records(world_id);
CREATE INDEX IF NOT EXISTS idx_worlds_guild_id   ON world_records(guild_id);
CREATE INDEX IF NOT EXISTS idx_worlds_created_at ON world_records(created_at);
```

**Design notes:**
- `ON CONFLICT REPLACE` is handled in the application upsert: preserve `created_at` and `id`, update all other fields and set `updated_at = now()`.
- `tags` and `platforms` are stored as JSON text so we can use SQLite's JSON1 extension (`json_each`, `json_array_length`, `json_extract`) for filtering.
- `vrchat_data` is a raw blob for future extensibility (e.g., if we later want to expose package sizes or version history without re-polling).
- Timestamps are Unix epoch integers for compactness and fast sorting.

---

## 4. Tag Taxonomy & Extraction

### 4.1 Allowed tags (from spec)

| Category       | Slug               |
|----------------|--------------------|
| Kino           | `kino`             |
| Chill          | `chill`            |
| Comfy          | `comfy`            |
| Adventure      | `adventure`        |
| Horror         | `horror`           |
| Game           | `game`             |
| Particle Live / VRMV | `particle live / vrmv` |
| Gallery        | `gallery`          |
| Meme           | `meme`             |
| Puzzle         | `puzzle`           |
| Driving        | `driving`          |
| Tech           | `tech`             |
| Nature         | `nature`           |
| Gamerip        | `gamerip`          |
| Portal         | `portal`           |

> **Note:** `particle live / vrmv` is a **single canonical tag string**. Extraction logic normalizes all variations (`particle live`, `vrmv`, `VRMV`, `Particle Live`, etc.) into this single canonical form.

### 4.2 Extraction strategy

Because tags historically appeared in many non-standard formats, the extractor must be resilient and catch tags wherever they appear — not just in rigid `Tags:` blocks.

**Strategies (applied in order, deduplicated across all passes):**

1. **Hashtag pass:** `#horror`, `#game`, `#nature`, `#particlelive` → strip `#`, lowercase, then canonicalize (`particlelive` → `particle live / vrmv`).

2. **Structured prefix pass:** Case-insensitive line or token matching.
   Prefixes: `Tags:`, `Tag:`, `Tag(s):`, `Category:`, `Type:`, `Map Type:`
   Also Japanese equivalents: `タグ:`, `種類:`, `カテゴリー:`
   Values may be comma-separated, space-separated, or line-separated.

3. **Custom matcher pass (per-account, like world/author extraction):**
   Some Twitter accounts have highly structured tag lines that don't fit generic patterns. We follow the same `customMatchers` pattern already used for world/author extraction — account-specific functions that return an array of tags.

4. **Inline / loose prose pass:**
   After removing URLs, scan the remaining text for taxonomy words appearing as whole words (not substrings). This catches tags written inline: *"A chill horror world with puzzle elements"* → `chill`, `horror`, `puzzle`.
   Uses word-boundary regex matching and the same canonicalization map.

5. **Validation & canonicalization pass:**
   - Normalize extracted tokens through a canonicalization map (e.g. `vrmv` → `particle live / vrmv`, `particlelive` → `particle live / vrmv`).
   - Intersect against the allowed taxonomy.
   - Store **only validated, canonical tags** in the database.
   - The original message content is preserved in `source_content` for any future re-processing needs.
   - Log discarded / non-matching tokens at `debug` level.

6. **Deduplication:** Tags stored as a JSON array in first-appearance order, no duplicates.

**New file:** `src/utils/tagExtractor/index.ts` (replaces existing `tagExtractor.ts`).

**Test coverage requirements:**
- `#horror #game` → `['horror', 'game']`
- `Tags: game\nTags: horror` → `['game', 'horror']`
- `Tags: horror, game, chill` → `['horror', 'game', 'chill']`
- `A chill horror world` → `['chill', 'horror']`
- `#vrmv` → `['particle live / vrmv']`
- `VRMV showcase` → `['particle live / vrmv']`
- Mixed valid + invalid → only validated taxonomy tags
- Duplicate tags across multiple strategies → deduplicated in first-appearance order
- Account-specific custom matchers override generic extraction

---

## 5. Phase Breakdown

### Phase 1 — SQLite Foundation ✅ COMPLETE

**Goal:** Create the database layer and schema. No changes to bot behavior yet.

**Files created:**
- `src/utils/database/index.ts` — `Database` class wrapping `better-sqlite3`
- `src/utils/database/schema.ts` — schema setup / migration runner
- `src/utils/database/worldRepository.ts` — CRUD + query methods:
  - `upsert(record: WorldRecord): void`
  - `getByWorldId(worldId: string): WorldRecord[]`
  - `getByWorldAndGuild(worldId, guildId): WorldRecord | undefined`
  - `deleteByWorldAndGuild(worldId, guildId): boolean`
  - `getAllPaginated(limit, offset, filters): { rows, total }`
  - `getUniqueTags(): { tag, count }[]`
  - `count(): number`
  - `getLastProcessed(): WorldRecord | undefined`

**Files modified:**
- `package.json` — add `better-sqlite3`, `@types/better-sqlite3`
- `src/assets/config.ts` — add `DATABASE_PATH` (default `./worlds.db`)
- `.env.sample` — add `DATABASE_PATH`

**Migration strategy:** On first access, `schema.ts` checks if the SQLite file exists. If not, it runs `CREATE TABLE` and `CREATE INDEX` statements automatically. Currently lazy (created on first `getDatabase()` call). May add eager initialization in `bot.ts` `ClientReady` if desired.

**Acceptance criteria:** ✅ Met
- `pnpm install` succeeds with `better-sqlite3`.
- Test script can insert, read, and delete a world record.
- `worlds.db` file is created on first access.
- 21 repository tests pass.

---

### Phase 2 — Data Pipeline Integration

**Goal:** Actually write rich metadata when the bot processes a world link.

**Modified files:**

#### `src/events/messageCreate/watchForVRCWorldLinks/index.ts`
- Replace the body of `processWorldId`:
  1. After `fetchWorldData`, call the new tag extractor on `sourceContent`.
  2. Build a `WorldRecord` object.
  3. Call `worldRepository.upsert(...)`.
  4. Remove the old `setValue(PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID, ...)` call.
- Remove or update `forceRefetchWorldFromMessage` to use the repository.

#### `src/events/messageCreate/watchForVRCWorldLinks/duplicateHandler/index.ts`
- `checkAndHandleDuplicate` now queries `worldRepository.getByWorldAndGuild(worldId, guildId)` instead of `getValue(PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID, ...)`.
- On new world: call `worldRepository.upsert` (saves the original message ID).

#### `src/events/messageCreate/watchForVRCWorldLinks/forwarding/index.ts`
- Remove `markWorldAsProcessed` (no longer needed; the repository upsert already marks it).
- `getForwardingChannels` stays unchanged (still reads `keyv-file` for forwarding channel config).

#### `src/utils/tagExtractor/index.ts` (rewrite)
- Export `extractTags(content: string): string[]` implementing the multi-strategy approach above.
- Add unit tests for all 6 strategies.

#### `src/utils/jsonAsDb/types.ts`
- Mark `PROCESSED_WORLDS` and `PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID` as deprecated (they will be removed after migration).
- Keep all non-world keys untouched.

**Acceptance criteria:** ✅ Met
- Posting a world link in a watched channel writes a row to `world_records` with all fields populated.
- Tags are extracted from both `#tag` and `Tags: tag` formats.
- Duplicate detection still works (reacts with ♻️ and replies with original link).
- Force-refetch works (skips duplicate check, re-embeds, overwrites the row).
- **Bonus:** `safeJsonStringify` helper fixes BigInt serialization crash from VRChat API.

---

### Phase 3 — Reaction Handlers & Commands

**Goal:** Update every feature that reads or mutates world records. Remove obsolete text commands superseded by richer reaction UX.

#### `src/utils/worldActions.ts` (new)
- Extract shared `deleteWorldForGuild(worldId, guildId)` helper.
- Wraps `worldRepository.deleteByWorldAndGuild()` which **archives** the row into `deleted_world_records` before removing it from the live table.

#### `src/events/messageReactionAdd/onReactionUndoWorldTag.ts`
- Replace dead KVP removals (`remove(PROCESSED_WORLDS)`, `removeValue(PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID)`) with:
  ```ts
  await deleteWorldForGuild(worldId, guildId); // archives into deleted_world_records
  ```
- Keep `REACTION_FORWARDED_MESSAGE_IDS` cleanup (tracks message forwarding, not world storage).
- Keep existing UX: deletes bot reply embed + sends confirmation embed with world name/author/thumbnail.

#### `src/events/messageReactionAdd/onReactionForceRefetch.ts`
- No DB changes needed — already uses repository via `processWorldId` from Phase 2.
- Force-refetch re-upserts the row, refreshing VRChat metadata (name, image, capacity, platforms, vrchat_data blob).

#### `src/events/messageCreate/remove.ts`
- **Deleted.** The `🔁` reaction shortcut provides richer feedback (confirmation embed with world name/thumbnail + message deletion) than a text command. No reason to maintain both.

#### `src/events/messageCreate/stats.ts`
- Replace `getUniqueWorldIds()` (parsed dead KVP keys) with SQLite queries:
  - `worldRepository.count()` for total worlds.
  - `worldRepository.getLastProcessed()` for last world (show name + clickable VRChat link).
  - `worldRepository.getUniqueTags()` for tag distribution.
- Show top 5 tags by frequency.
- Omit "Unique Tags" count box (tags are predetermined taxonomy).

#### `src/events/messageCreate/export.ts` + `.exportFull`
- **Deleted entirely.** Superseded by Phase 4 Fastify API + GitHub Pages explorer. Users browse/filter via the web UI instead of downloading CSVs.

#### `src/exportServer.ts`
- Already deleted in Phase 1 cleanup. Phase 4 replaces it with Fastify.

**Acceptance criteria:** ✅ Met
- [x] `🔁` undo reaction on a bot world-reply **moves the row into `deleted_world_records`** (archive), removes the bot message, and posts a confirmation embed with the world's name, author, and thumbnail. Re-posting the same world is treated as fresh (not a duplicate).
- [x] `.remove` command no longer exists (removed from command router).
- [x] `.stats` shows: total **live** world count, last processed world as a clickable VRChat link with name/author, top 5 tags by frequency, uptime, memory usage, platform, version. No stale pre-Phase-2 data.
- [x] `.export` and `.exportFull` commands no longer exist.
- [x] Force-refetch (`♻️` reaction) still works: skips duplicate check, re-fetches VRChat API, re-upserts the row with fresh metadata.
- **Bonus:** `quality` column added to schema with `.setQualityChannel` / `.clearQualityChannel` commands and reaction-based `updateQuality()` tracking.

---

### Phase 4 — Fastify API Server

**Goal:** Replace the raw Node `http` server with Fastify and expose richer, filterable endpoints.

**Dependencies:** `fastify`, `@fastify/cors`

**New files:**
- `src/apiServer/index.ts`
  - `createApiServer()` → Fastify instance
  - `startApiServer()` → listen loop
  - Auth plugin: Bearer token check (reuse `EXPORT_API_TOKEN` or rename to `API_TOKEN`)
  - CORS plugin: `*` (for GitHub Pages / browser consumers)
- `src/apiServer/routes/worlds.ts`
- `src/apiServer/routes/tags.ts`
- `src/apiServer/routes/health.ts`
- `src/apiServer/plugins/auth.ts`
- `src/apiServer/plugins/errorHandler.ts`

**API Specification:**

#### `GET /api/health`
```json
{
  "status": "ok",
  "worldCount": 1428,
  "dbVersion": 1
}
```

#### `GET /api/worlds`
**Query params:**
- `tag` (repeatable): `?tag=horror&tag=game`
- `guildId` (optional): filter to one guild
- `limit`: default 50, max 500
- `offset`: default 0

**Response:**
```json
{
  "total": 1428,
  "limit": 50,
  "offset": 0,
  "worlds": [
    {
      "worldId": "wrld_...",
      "guildId": "...",
      "messageId": "...",
      "name": "Spooky Mansion",
      "authorName": "GhostDev",
      "capacity": 16,
      "platforms": ["standalonewindows", "android"],
      "tags": ["horror", "game"],
      "imageUrl": "https://api.vrchat.cloud/...",
      "vrchatUrl": "https://vrchat.com/home/world/wrld_...",
      "discordMessageUrl": "https://discord.com/channels/.../.../...",
      "createdAt": "2025-06-01T12:00:00Z"
    }
  ]
}
```

#### `GET /api/worlds/:worldId`
Returns a single world (first match if multiple guilds; can add `?guildId=` to disambiguate).

#### `GET /api/tags`
```json
{
  "tags": [
    { "tag": "horror", "count": 312 },
    { "tag": "chill", "count": 198 },
    { "tag": "game", "count": 145 }
  ]
}
```

**Modified files:**
- `src/assets/config.ts` — add `API_PORT` (default 3000), `API_TOKEN` (reuse `EXPORT_API_TOKEN` env var or add `API_TOKEN`)
- `src/bot.ts` — import `startApiServer` and call it in `ClientReady` (same pattern as current `startExportServer`).
- `index.ts` — no change (still just `import './src/bot'`).

**Old export server:** Deprecate `src/exportServer.ts`. It can be deleted once the Pages site and any downstream consumers are updated to the new Fastify routes.

**Acceptance criteria:** ✅ Met
- Fastify boots on `ClientReady`.
- `GET /api/worlds` returns paginated world records.
- `GET /api/worlds?tag=horror` returns only horror-tagged worlds.
- `GET /api/tags` returns all tags sorted by count descending.
- Unauthorized requests receive `401`.
- Server-identifying fields (`guildId`, `messageId`, `sourceContent`, `vrchatData`) stripped from responses.
- `quality` (`'good'|'bad'|null`) included in world output.
- **Deviations from plan:**
  - `?guildId=` filter omitted (not needed for global explorer use case).
  - Auth hook inlined into `index.ts` instead of separate `plugins/auth.ts` file.
  - `src/apiServer/plugins/errorHandler.ts` created (was in plan but now implemented).
- **Bonus features added:**
  - `.apiStart` / `.apiStop` admin commands (`withProtection`).
  - Graceful shutdown: `SIGINT`/`SIGTERM` stops API server + destroys Discord client; `.die` closes API before exit.
  - `API_TOKEN` supports comma-separated array of valid tokens.
  - `src/apiServer/apiServer.test.ts` with 13 tests using `fastify.inject()`.

---

### Phase 5 — V1 → V2 Migration Script ✅ COMPLETE

**Goal:** Convert existing `db.json` world data into the SQLite schema.

**New file:** `scripts/migrate-v1-to-v2.ts`

**Logic:**
1. Read `db.json` using the existing `keyv-file` module (or raw JSON parse of the `cache` array).
2. Iterate over `PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID` entries.
3. For each `${worldId}-${guildId}` → `messageId`:
   - Parse world ID and guild ID.
   - **Best-effort rehydration:** Call VRChat API for `name`, `authorName`, `capacity`, `platforms`, `imageUrl`. If API fails (rate limit, world deleted), leave fields null.
   - **Best-effort tag extraction:** If the original Discord message is still accessible via `messageId`, fetch its content and run the tag extractor. If not accessible (message deleted, no permissions), leave `tags` empty.
   - Insert row into SQLite.
4. After successful migration, rename `db.json` → `db.json.v1-migrated` and print a summary report.

**Execution:**
```bash
npx ts-node scripts/migrate-v1-to-v2.ts
```

Run **once** on the droplet after deploying the V2 code but **before** starting the bot.

**Risk mitigation:**
- The script is idempotent: `ON CONFLICT REPLACE` means re-running it just overwrites rows.
- Print a dry-run mode (`--dry-run`) that counts how many rows would be created without writing.
- Log any worlds where the VRChat API returned 404 (world deleted or private).

**Acceptance criteria:** ✅ Met
- Migration script runs without crashing.
- All V1 world records appear in SQLite.
- `worlds.db` is valid and queryable.
- Bot starts cleanly after migration.
- **Test results (dev run):** 89/95 worlds migrated successfully. 6 not found (3 deleted/private worlds + 3 test entries).
- **Deviation from plan:** Tag extraction from historical Discord messages was skipped. Tags are left empty and will be backfilled via `.crawlHistory --tags` or future re-posts.

---

### Phase 6 — Cleanup & Testing

**Tasks:**

1. **Delete orphan code:** ✅ Done
   - `src/utils/jsonAsDb/handlers/worldRecord.ts` — deleted.
   - `src/utils/helpers/tagExtractor.ts` — deleted.
   - `src/exportServer.ts` — deleted.
   - `src/events/messageCreate/export.ts` — deleted.
   - `src/events/messageCreate/remove.ts` — deleted.

2. **Update tests:** ✅ Done
   - `src/events/messageCreate/watchForVRCWorldLinks/duplicateHandler/duplicateHandler.test.ts` — mocks repository.
   - `src/utils/tagExtractor/tagExtractor.test.ts` — 31 tests.
   - `src/utils/database/worldRepository.test.ts` — in-memory SQLite.
   - `src/apiServer/apiServer.test.ts` — 13 tests with `fastify.inject()`.

3. **Update environment sample:** ✅ Done
   - `.env.sample` — `DATABASE_PATH`, `API_PORT`, `API_TOKEN` added.

4. **Update documentation:** ⏳ Partially done
   - `manual/API.md` — created with endpoint docs and cURL examples.
   - `README.md` — deferred until all phases complete.

5. **Verify existing features still work:** ⏳ Pending manual smoke test
   - `.watch`, `.unwatch`, `.forwardReact`, `.forwardAndroid`, `.forwardMaxSlots`, `.forwardLowCap`
   - Reaction forwarding, reaction-to-delete, recycle refetch, undo
   - History crawl
   - `.ignoreMe`, `.unignoreMe`

6. **Retroactive quality tagging + tag backfill:** ✅ Done
   - Re-purposed `.crawlHistory` with three modes:
     - `.crawlHistory #channel --tags` — rebuilds tags and `source_content` from historical messages
     - `.crawlHistory #channel --quality good|bad` — assigns quality to worlds in a channel
   - Scans embed URLs + descriptions for world IDs (forwarded messages have empty `.content`)
   - Uses `repo.updateTags()` and `repo.updateQuality()` for lightweight writes
   - Skips worlds not in SQLite with logged warning
   - Mode-specific progress stats (records updated / not found)
   - `.updateQuality` standalone command **not needed** — crawl-based approach is sufficient
   - Checks **both** raw message content and bot embed URLs (forwarded embeds may have the world link in the embed description rather than the message text).
   - For each found world: calls `repo.updateQuality(worldId, guildId, quality)`. Worlds not found in SQLite are skipped with a logged warning.
   - `--dry-run` mode: performs the full scan, counts how many worlds would be updated and how many would be skipped, prints a preview report, but writes nothing to the database.
   - Shows live progress during the scan (e.g., "Scanned 3,200 messages, updated 87 worlds to 'good'").
   - Accept an optional `--limit` parameter to cap the number of messages scanned.

**Acceptance criteria:**
- [x] All existing tests pass (or are updated to pass).
- [x] New tests cover tag extraction, repository CRUD, and API routes.
- [x] `pnpm lint` and `pnpm test` pass in CI. ✅ 185 tests passing, lint clean.

---

## 6. File Change Summary

### New files (Phase 1–4 done)
- ✅ `src/utils/database/index.ts`
- ✅ `src/utils/database/schema.ts`
- ✅ `src/utils/database/worldRepository.ts`
- ✅ `src/utils/database/worldRepository.test.ts`
- ✅ `src/utils/tagExtractor/index.ts`
- ✅ `src/utils/tagExtractor/tagExtractor.test.ts`
- ✅ `src/utils/worldActions.ts`
- ✅ `src/events/messageCreate/setQualityChannel.ts`
- ✅ `src/events/messageCreate/clearQualityChannel.ts`
- ✅ `src/events/messageCreate/apiStart.ts`
- ✅ `src/events/messageCreate/apiStop.ts`
- ✅ `src/apiServer/index.ts`
- ✅ `src/apiServer/routes/worlds.ts`
- ✅ `src/apiServer/routes/tags.ts`
- ✅ `src/apiServer/routes/health.ts`
- ✅ `src/apiServer/plugins/errorHandler.ts`
- ✅ `src/apiServer/apiServer.test.ts`
- ✅ `manual/API.md`

### New files (Phase 5 done)
- ✅ `scripts/migrate-v1-to-v2.ts`

### New files (Phase 6 done)
- (none — `.updateQuality` standalone command not needed; crawl-based approach is sufficient)

### Significantly modified files (done)
- ✅ `src/events/messageCreate/watchForVRCWorldLinks/index.ts`
- ✅ `src/events/messageCreate/watchForVRCWorldLinks/duplicateHandler/index.ts`
- ✅ `src/events/messageCreate/watchForVRCWorldLinks/forwarding/index.ts`
- ✅ `src/events/messageReactionAdd/onReactionUndoWorldTag.ts`
- ✅ `src/events/messageCreate/stats.ts`
- ✅ `src/events/messageCreate/crawlHistory.ts` — repurposed with discover/tags/quality modes
- ✅ `src/assets/config.ts`
- ✅ `src/bot.ts`
- ✅ `.env.sample`

### Deleted / replaced files (done)
- ✅ `src/utils/helpers/tagExtractor.ts` → replaced by `src/utils/tagExtractor/`
- ✅ `src/utils/jsonAsDb/handlers/worldRecord.ts` → deleted
- ✅ `src/exportServer.ts` → deleted
- ✅ `src/events/messageCreate/export.ts` → deleted
- ✅ `src/events/messageCreate/remove.ts` → deleted

### Minor modifications (done)
- ✅ `src/utils/jsonAsDb/types.ts` — world keys marked `@deprecated`
- ✅ `package.json` — `better-sqlite3`, `@types/better-sqlite3`, `fastify`, `@fastify/cors`

---

## 7. Open Questions (Resolved)

1. **Store all hashtags or only validated taxonomy tags?**
   **Resolved:** Store **only validated taxonomy tags**. The original message content is preserved in `source_content` for any future re-processing needs.

2. **`particle live` vs `vrmv`?**
   **Resolved:** One canonical tag: `"particle live / vrmv"`. Extraction logic normalizes all variations into this single string.

3. **Should `.exportFull` still re-poll VRChat API?**
   **Resolved:** Out of scope for V2. `.exportFull` will not be modified in this iteration.

4. **Fastify in same process or separate?**
   **Proposal:** Same process for V2. One PM2 app.

5. **Guild-scoped or global world lists in API?**
   **Proposal:** API defaults to global (`/api/worlds` returns all records, deduplicated by `worldId` for the list view). Add `?guildId=` for guild-specific queries. Full record at `/api/worlds/:worldId` can return an array of all guild instances.

---

## 8. Rollout Checklist (Post-Implementation)

- [ ] Merge V2 branch to `main`
- [ ] Deploy to droplet on a new branch / tag (keep V1 running)
- [ ] Run `npx jiti scripts/migrate-v1-to-v2.ts --dry-run` on the droplet
- [ ] Run `npx jiti scripts/migrate-v1-to-v2.ts` on the droplet
- [ ] Verify `worlds.db` has expected row count
- [ ] **Backfill tags and source_content:** Run `.crawlHistory #watched-channel --tags` for each channel that contains original world posts (resolves Twitter links, extracts tags, updates SQLite)
- [ ] **Assign quality ratings:**
  - Run `.crawlHistory #good-channel --quality good` for the good maps channel
  - Run `.crawlHistory #bad-channel --quality bad` for the bad maps channel
- [ ] Verify tag distribution with `.stats` or `sqlite3 worlds.db "SELECT value, COUNT(*) FROM world_records, json_each(tags) GROUP BY value"`
- [ ] Verify quality counts with `sqlite3 worlds.db "SELECT quality, COUNT(*) FROM world_records WHERE quality IS NOT NULL GROUP BY quality"`
- [ ] Update GitHub Actions Pages workflow to hit new Fastify endpoints (`/api/worlds`, `/api/tags`)
- [ ] Update GitHub Pages site to use tag filtering and richer metadata
- [ ] Run smoke tests: post a world, verify DB row, check `/api/worlds`, test `🔁` undo reaction, `.stats`, `.crawlHistory`
- [ ] Shut down V1 instance once V2 is stable
- [ ] Clean up obsolete keys from `db.json`:
  - `npx jiti scripts/cleanup-db-json.ts --dry-run`
  - `npx jiti scripts/cleanup-db-json.ts`

---

**End of plan. Phases 1–6 complete. All major features implemented.**
