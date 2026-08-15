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
- **Twitter/X support** - Extracts world info from tweets, including when world name and author are in plain text (uses VRChat API search + fuzzy matching, handled by the API service)
- **Channel history crawling** - Backfill past messages in a channel for world links (supports `--tags` and `--quality` modes)
- **Standalone REST API** - The bot reads and writes world data through the separate `sos-world-tagger-api` service (see [Architecture](#architecture))
- **SQLite storage** - World metadata is stored by the standalone API in **better-sqlite3** with migrations, replacing the legacy file-based Keyv store
- **Export** - Export world data as CSV
- **User ignore list** - Users can opt out of bot processing with `.ignoreMe` / `.unignoreMe`

## Prerequisites

- Node.js
- A Discord bot token

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
| `ADMIN_ID` | Comma-separated Discord user IDs with admin privileges |
| `EXPORT_RATE_LIMIT` | Delay (ms) between API calls during export (default: 1500) |
| `DEV` | Set to `true` to disable duplicate checks |
| `FORWARD_PLAYER_COUNT_THRESHOLD` | Min player capacity for high-capacity forwarding (default: 40) |
| `LOW_CAPACITY_THRESHOLD` | Max player capacity for low-capacity forwarding (default: 20) |
| `API_BASE_URL` | Base URL of the standalone `sos-world-tagger-api` service (default: `http://localhost:3000`) |
| `API_TOKEN` | Bearer token the bot sends to the API. Falls back to `EXPORT_API_TOKEN` if not set. |

## Usage

### Start the bot

```bash
pnpm start
```

### Commands

Most commands require your Discord user ID to appear in `ADMIN_ID`. You run commands in a normal text channel; when a command needs a specific channel, **mention that channel** with `#` (the bot uses the first channel mention in the message).

For automatic world-link handling (embeds, duplicates, criteria-based forwards), see [manual/world-link-processing.md](manual/world-link-processing.md). For reaction-based forwarding and react-to-delete, see [manual/reaction-forwarding.md](manual/reaction-forwarding.md).

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

World metadata (records, tags, quality ratings) lives in the **standalone
`sos-world-tagger-api`** service, which owns the SQLite database. The bot
reads and writes through that API's endpoints (add, delete, quality, tags,
stats). The database itself lives on the API host.

Bot configuration (watched channels, forwarding channels, reaction mappings,
user ignore list) continues to be stored in `db.json` (Keyv-file).

## REST API

The bot talks to the standalone API service (`sos-world-tagger-api`) at
`API_BASE_URL`, authenticating with `API_TOKEN` (Bearer). The API owns the
SQLite world database and exposes both read and mutation endpoints. See the
API repo's documentation for the full endpoint reference.

The bot uses these endpoints internally:

| Endpoint | Used for |
|----------|----------|
| `POST /api/worlds` | Tagging a world from a message; duplicate detection returns the original message ID |
| `POST /api/worlds/extract` | Resolving world IDs from message content (direct links, Twitter/X links, plain-text world names) |
| `GET /api/worlds/search` | Live VRChat world search by name (plain-text tweet resolution) |
| `DELETE /api/worlds/:worldId` | Undo-tag / remove flows |
| `PUT /api/worlds/:worldId/quality` | Quality reactions (good/bad) |
| `PUT /api/worlds/:worldId/tags` | CrawlHistory tag rebuild (tags computed server-side) |
| `GET /api/worlds/pairs` | CrawlHistory processed-world cache |
| `GET /api/health`, `GET /api/tags`, `GET /api/worlds` | `.stats` command |

## Migration from v1

The one-time v1 → v2 migration (Keyv `db.json` world records → SQLite) was
completed when the database moved to the standalone API. The migration and
randomization scripts now live in the API repository, which owns the database.

A cleanup script for removing stale Keyv entries from `db.json` is still
available:

```bash
pnpm tsx scripts/cleanup-db-json.ts
```

## Documentation

- **World link processing** - [manual/world-link-processing.md](manual/world-link-processing.md) - detection, duplicates, embed reply, and criteria-based forwarding (with diagrams).
- **Reaction forwarding** - [manual/reaction-forwarding.md](manual/reaction-forwarding.md) - setup, react-to-delete, and reaction handler flows (with diagrams).

## Scripts

- **`scripts/backup-db.sh`** — Backs up `db.json` to a configurable directory. Edit `SOURCE` and `BACKUP_DIR` before use. Removes backups older than 7 days.
- **`scripts/delete-stale-logs.sh`** — Deletes compressed log files older than 7 days. Edit `LOG_DIR` (or `BACKUP_DIR` if used for logs) before use.
- **`scripts/cleanup-db-json.ts`** — Removes stale/deprecated Keyv entries from `db.json` after migration.

## Tech Stack

- **TypeScript** — Main language
- **Discord.js** (v14) — Discord API
- **sos-world-tagger-api** — Standalone REST API owning the world database, VRChat data fetching, and all world/tweet extraction logic
- **keyv-file** — File-based key-value storage (bot config)
- **tslog** — Logging with rotating file output

## License

ISC
