# VRC World Tagger Bot

A Discord bot that monitors channels for VRChat world links and automatically enriches them with world metadata-including name, author, capacity, platform support, tags, quality ratings, and download sizes. It can forward worlds to specialized channels based on criteria like Android support, player capacity, or emoji reactions.

## Features

- **World link detection** - Detects VRChat world links in messages (direct links, Twitter/X links, vxtwitter embeds)
- **Rich embeds** - Replies with Discord embeds showing world name, author, max slots, supported platforms (PC, Quest, Android), and download sizes
- **Tag extraction** - Automatically extracts canonical taxonomy tags (`kino`, `chill`, `horror`, `game`, etc.) from message content via hashtags, structured prefix lines, and inline prose matching
- **Quality rating** - Mark worlds as `good` or `bad` via configured quality channels; rating is stored in the database and queryable via the API
- **Channel watching** - Watch specific channels for world links; unwatched channels are ignored
- **Smart forwarding** - Automatically forwards worlds to dedicated channels when they meet criteria (a world can match multiple rules in one go):
  - **Android support** - Worlds that support Android/Quest
  - **High capacity** - Worlds with player count at or above a configurable threshold (default: 40)
  - **Low capacity** - Worlds with player count at or below a configurable threshold (default: 20)
- **Reaction forwarding** - Map emojis to destination channels; adding that emoji on a message in a watched-reacts channel forwards the message (once per message)
- **React-to-delete** - Register emojis to delete the bot's own messages in watched-reacts channels
- **Force refetch** - React with ♻ on a bot embed to force re-fetch world data from the VRChat API
- **Undo world tag** - React with ↩️ on a bot embed to remove the world from the database and delete the bot's message
- **Duplicate detection** - Prevents re-processing the same world in a channel
- **Twitter/X support** - Extracts world info from tweets, including when world name and author are in plain text (uses VRChat API search + fuzzy matching)
- **Channel history crawling** - Backfill past messages in a channel for world links (supports `--tags` and `--quality` modes)
- **REST API server** - Built-in Fastify API for querying world records, filtering by tags and quality, with Bearer token authentication
- **SQLite storage** - World metadata stored in **better-sqlite3** with migrations, replacing the legacy file-based Keyv store
- **Export** - Export world data as CSV
- **User ignore list** - Users can opt out of bot processing with `.ignoreMe` / `.unignoreMe`

## Prerequisites

- Node.js
- A Discord bot token
- VRChat API credentials (username, password, and TOTP key for 2FA)

## Installation

```bash
pnpm install
```

## Configuration

Copy `.env.sample` to `.env` and fill in your values:

```bash
cp .env.sample .env
```

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Discord bot token |
| `VRC_USERNAME` | VRChat account username |
| `VRC_PASSWORD` | VRChat account password |
| `VRC_TOTP_KEY` | TOTP secret for VRChat 2FA |
| `ADMIN_ID` | Comma-separated Discord user IDs with admin privileges |
| `EXPORT_RATE_LIMIT` | Delay (ms) between API calls during export (default: 1500) |
| `DEV` | Set to `true` to disable duplicate checks |
| `WORLD_NAME_MATCHERS` | Comma-separated strings to match world name labels in tweets |
| `AUTHOR_NAME_MATCHERS` | Comma-separated strings to match author labels in tweets |
| `FORWARD_PLAYER_COUNT_THRESHOLD` | Min player capacity for high-capacity forwarding (default: 40) |
| `LOW_CAPACITY_THRESHOLD` | Max player capacity for low-capacity forwarding (default: 20) |
| `API_PORT` | Port for the built-in REST API server (default: `3000`) |
| `API_TOKEN` | Comma-separated Bearer tokens for API authentication. Falls back to `EXPORT_API_TOKEN` if not set. |
| `API_ALLOWED_ORIGINS` | Comma-separated allowed `Origin` values for CORS and origin validation. Example: `https://sosd.googoogaagaa.club,https://testnet.googoogaagaa.club`. Leave empty to allow any origin. |
| `API_ALLOWED_IPS` | Comma-separated allowed source IP addresses for `/api/*` endpoints. Useful for admin/scripted access. Example: `203.0.113.42,127.0.0.1`. Leave empty to disable. When set, the API trusts loopback reverse proxies to report the real client IP. |
| `DATABASE_PATH` | Path to the SQLite database file (default: `./worlds.db`) |

## Usage

### Start the bot

```bash
pnpm start
```

### Commands

Most commands require your Discord user ID to appear in `ADMIN_ID`. You run commands in a normal text channel; when a command needs a specific channel, **mention that channel** with `#` (the bot uses the first channel mention in the message).

For automatic world-link handling (embeds, duplicates, criteria-based forwards), see [manual/world-link-processing.md](manual/world-link-processing.md). For reaction-based forwarding and react-to-delete, see [manual/reaction-forwarding.md](manual/reaction-forwarding.md). For the REST API, see [manual/API.md](manual/API.md).

#### Ignore list

| Command | Admin | Description | Example |
|---------|-------|-------------|---------|
| `.ignoreMe` | No | Adds you to the ignore list; the bot stops processing your messages and reactions until you opt back in. | `.ignoreMe` |
| `.unignoreMe` | No | Removes you from the ignore list. While ignored, this is the **only** command the bot still handles for you. | `.unignoreMe` |

#### Channel watching

**`.watch`**

- **Description:** Start watching a channel for VRChat world links (embeds, forwarding, duplicate tracking).
- **Usage:** `.watch #channel`
- **Admin:** Yes
- **Example:** `.watch #vrchat-worlds`

**`.unwatch`**

- **Description:** Stop watching a channel for world links.
- **Usage:** `.unwatch #channel`
- **Admin:** Yes
- **Example:** `.unwatch #vrchat-worlds`

#### Automatic forwarding (world criteria)

Each command sets **one** destination for that rule. If a world matches several rules, it may be forwarded to **several** channels in one processing pass.

**`.forwardAndroid`**

- **Description:** Set the channel where worlds with Android/Quest support are forwarded.
- **Usage:** `.forwardAndroid #channel`
- **Admin:** Yes
- **Example:** `.forwardAndroid #android-worlds`

**`.forwardMaxSlots`**

- **Description:** Set the channel where high-capacity worlds are forwarded (capacity ≥ `FORWARD_PLAYER_COUNT_THRESHOLD`, default 40).
- **Usage:** `.forwardMaxSlots #channel`
- **Admin:** Yes
- **Example:** `.forwardMaxSlots #big-venues`

**`.forwardLowCap`**

- **Description:** Set the channel where low-capacity worlds are forwarded (capacity ≤ `LOW_CAPACITY_THRESHOLD`, default 20).
- **Usage:** `.forwardLowCap #channel`
- **Admin:** Yes
- **Example:** `.forwardLowCap #small-worlds`

**`.clearForwardingChannels`**

- **Description:** Clear all automatic forwarding destinations (Android, high-cap, low-cap). Does not change watched channels or reaction-forward settings.
- **Usage:** `.clearForwardingChannels`
- **Admin:** Yes
- **Example:** `.clearForwardingChannels`

#### Reaction forwarding and cleanup

See [manual/reaction-forwarding.md](manual/reaction-forwarding.md) for setup, emoji details, and flow diagrams.

**`.watchReacts`**

- **Description:** Mark a channel so reactions there can trigger emoji→channel forwarding (after you map emojis with `.forwardReact`).
- **Usage:** `.watchReacts #channel`
- **Admin:** Yes
- **Example:** `.watchReacts #inbox`

**`.unwatchReacts`**

- **Description:** Stop watching a channel for reaction-based forwarding.
- **Usage:** `.unwatchReacts #channel`
- **Admin:** Yes
- **Example:** `.unwatchReacts #inbox`

**`.forwardReact`**

- **Description:** Map an emoji to a destination channel; in watched react channels, adding that emoji forwards the message (once per message).
- **Usage:** `.forwardReact <emoji> #channel`
- **Admin:** Yes
- **Example:** `.forwardReact 📌 #saved`

**`.listReacts`**

- **Description:** List emoji→channel mappings (with indices for removal).
- **Usage:** `.listReacts`
- **Admin:** Yes
- **Example:** `.listReacts`

**`.removeReact`**

- **Description:** Remove a forwarding mapping by emoji or by 1-based index from `.listReacts`.
- **Usage:** `.removeReact <emoji>` or `.removeReact <index>`
- **Admin:** Yes
- **Example:** `.removeReact 1`

**`.addDeleteReact`**

- **Description:** Register an emoji so that, in `.watchReacts` channels, reacting with it on **the bot's messages** deletes those messages (coordinates with `.forwardReact` when both apply).
- **Usage:** `.addDeleteReact <emoji>`
- **Admin:** Yes
- **Example:** `.addDeleteReact 🗑️`

**`.removeDeleteReact`**

- **Description:** Remove a react-to-delete emoji by the same emoji string or by 1-based index (indices appear under **React to delete** in `.listReacts`).
- **Usage:** `.removeDeleteReact <emoji>` or `.removeDeleteReact <index>`
- **Admin:** Yes
- **Example:** `.removeDeleteReact 🗑️`

#### Quality channels

**`.setQualityChannel`**

- **Description:** Mark a channel as a quality-tracking destination. When a world is reaction-forwarded to that channel, the bot records its quality (`good` or `bad`) in the database. Only one channel per quality at a time.
- **Usage:** `.setQualityChannel <good|bad> #channel`
- **Admin:** Yes
- **Example:** `.setQualityChannel good #good-maps`

**`.clearQualityChannel`**

- **Description:** Clear the quality-channel assignment for `good` or `bad`.
- **Usage:** `.clearQualityChannel <good|bad>`
- **Admin:** Yes
- **Example:** `.clearQualityChannel bad`

#### API server

**`.apiStart`**

- **Description:** Start the built-in REST API server if it is not already running.
- **Usage:** `.apiStart`
- **Admin:** Yes
- **Example:** `.apiStart`

**`.apiStop`**

- **Description:** Stop the REST API server.
- **Usage:** `.apiStop`
- **Admin:** Yes
- **Example:** `.apiStop`

#### World data and history

**`.export`**

- **Description:** Export a CSV of processed world IDs and URLs (no live VRChat API calls per world).
- **Usage:** `.export`
- **Admin:** No
- **Example:** `.export`

**`.exportFull`**

- **Description:** Export a detailed CSV with live VRChat API data per world; rate-limited and resource-heavy.
- **Usage:** `.exportFull`
- **Admin:** Yes
- **Example:** `.exportFull`

**`.crawlHistory`**

- **Description:** Scan a channel's message history for world links. Supports three modes:
  - **Default (discover):** Finds new worlds and processes them with duplicate logic.
  - **`--tags`:** Rebuilds tags and `source_content` from message history for already-discovered worlds.
  - **`--quality good|bad`:** Assigns a quality rating to already-discovered worlds.
  Crawls are resumable if interrupted, and can be cancelled by reacting with ❌ on the progress message.
- **Usage:** `.crawlHistory #channel [--tags | --quality good|bad]`
- **Admin:** Yes
- **Example:** `.crawlHistory #vrchat-worlds`

**`.crawlStatus`**

- **Description:** Show crawl progress or completion status for a channel.
- **Usage:** `.crawlStatus #channel`
- **Admin:** No
- **Example:** `.crawlStatus #vrchat-worlds`

#### Maintenance

**`.stats`**

- **Description:** Show bot statistics (only works in channels that are watched with `.watch`).
- **Usage:** `.stats`
- **Admin:** No
- **Example:** `.stats`

**`.remove`**

- **Description:** In a **watched** channel, remove duplicate-tracking for a world whose link appears in the same message (lets that world be posted again as "new" in this guild). Does not unwatch channels or delete forwarded copies.
- **Usage:** `.remove <message containing a world link>` (e.g. paste the world URL in the command line)
- **Admin:** Yes
- **Example:** `.remove https://vrchat.com/home/world/wrld_...`

**`.die`**

- **Description:** Shut down the bot process gracefully.
- **Usage:** `.die`
- **Admin:** Yes
- **Example:** `.die`

## Data Storage

The bot stores its state and world metadata using **SQLite** (via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)). The database is created automatically at the path specified by `DATABASE_PATH` (default: `./worlds.db`).

Key tables:
- **`world_records`** — World metadata with tags, quality ratings, platform info, and VRChat API data. Deduplicated by `(world_id, guild_id)`.
- **`deleted_world_records`** — Archived copies of removed world records.
- **`_migrations`** — Tracks applied schema migrations.

Additional bot configuration (watched channels, forwarding channels, reaction mappings, user ignore list) continues to be stored in `db.json` (Keyv-file).

## REST API

The bot includes a built-in Fastify REST API server for querying world records. See [manual/API.md](manual/API.md) for full documentation.

**Endpoints:**

| Endpoint | Description | Auth |
|----------|-------------|------|
| `GET /api/health` | Health check | No |
| `GET /api/worlds` | Paginated world list with tag/quality filters | Bearer token |
| `GET /api/worlds/:worldId` | Single world record | Bearer token |
| `GET /api/tags` | All unique tags with occurrence counts | Bearer token |

The API server starts automatically on bot launch and listens on `0.0.0.0:<API_PORT>`. It can also be started/stopped via the `.apiStart` and `.apiStop` Discord commands.

## Migration from v1

If you are upgrading from the legacy Keyv-based file storage, a migration script is available:

```bash
pnpm tsx scripts/migrate-v1-to-v2.ts
```

This reads world records from `db.json` (`PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID`), fetches live data from the VRChat API, and inserts them into the SQLite database.

Use `--dry-run` to preview without writing:

```bash
pnpm tsx scripts/migrate-v1-to-v2.ts --dry-run
```

After migration, `db.json` is left in place (it still holds active config). The old processed-worlds keys can be manually removed once the migration is verified.

A cleanup script for removing stale Keyv entries from `db.json` is also available:

```bash
pnpm tsx scripts/cleanup-db-json.ts
```

## Documentation

- **World link processing** - [manual/world-link-processing.md](manual/world-link-processing.md) - detection, duplicates, embed reply, and criteria-based forwarding (with diagrams).
- **Reaction forwarding** - [manual/reaction-forwarding.md](manual/reaction-forwarding.md) - setup, react-to-delete, and reaction handler flows (with diagrams).
- **REST API** - [manual/API.md](manual/API.md) - endpoints, authentication, filtering, pagination, and example requests.

## Scripts

- **`scripts/backup-db.sh`** — Backs up `db.json` to a configurable directory. Edit `SOURCE` and `BACKUP_DIR` before use. Removes backups older than 7 days.
- **`scripts/delete-stale-logs.sh`** — Deletes compressed log files older than 7 days. Edit `LOG_DIR` (or `BACKUP_DIR` if used for logs) before use.
- **`scripts/migrate-v1-to-v2.ts`** — Migrates world records from legacy Keyv-file (`db.json`) to SQLite (`worlds.db`). See [Migration from v1](#migration-from-v1) above.
- **`scripts/cleanup-db-json.ts`** — Removes stale/deprecated Keyv entries from `db.json` after migration.

## Tech Stack

- **TypeScript** — Main language
- **Discord.js** (v14) — Discord API
- **vrchat** — VRChat API client
- **better-sqlite3** — SQLite database for world metadata
- **Fastify** — REST API server with CORS and Bearer token auth
- **keyv-file** — File-based key-value storage (bot config)
- **tslog** — Logging with rotating file output
- **fastest-levenshtein** — Fuzzy string matching for world/author resolution from tweets

## License

ISC
