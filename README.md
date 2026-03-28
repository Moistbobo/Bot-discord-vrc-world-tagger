# VRC World Tagger Bot

A Discord bot that monitors channels for VRChat world links and automatically enriches them with world metadata—including name, author, capacity, platform support, and download sizes. It can also forward worlds to specialized channels based on criteria like Android support or player capacity.

## Features

- **World link detection** — Detects VRChat world links in messages (direct links and links shared via Twitter/X)
- **Rich embeds** — Replies with Discord embeds showing world name, author, max slots, supported platforms (PC, Quest, Android), and download sizes
- **Channel watching** — Watch specific channels for world links; unwatched channels are ignored
- **Smart forwarding** — Automatically forwards worlds to dedicated channels when they meet criteria (a world can match multiple rules in one go):
  - **Android support** — Worlds that support Android/Quest
  - **High capacity** — Worlds with player count at or above a configurable threshold (default: 40)
  - **Low capacity** — Worlds with player count at or below a configurable threshold (default: 20)
- **Duplicate detection** — Prevents re-processing the same world in a channel
- **Twitter/X support** — Extracts world info from tweets, including when world name and author are in plain text (uses VRChat API search + fuzzy matching)
- **Channel history crawling** — Backfill past messages in a channel for world links
- **Export** — Export watched worlds data (with rate limiting)

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

## Usage

### Start the bot

```bash
pnpm start
```

### Commands

Most commands require your Discord user ID to appear in `ADMIN_ID`. You run commands in a normal text channel; when a command needs a specific channel, **mention that channel** with `#` (the bot uses the first channel mention in the message).

For automatic world-link handling (embeds, duplicates, criteria-based forwards), see [manual/world-link-processing.md](manual/world-link-processing.md). For reaction-based forwarding and react-to-delete, see [manual/reaction-forwarding.md](manual/reaction-forwarding.md).

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

- **Description:** Register an emoji so that, in `.watchReacts` channels, reacting with it on **the bot’s messages** deletes those messages (coordinates with `.forwardReact` when both apply).
- **Usage:** `.addDeleteReact <emoji>`
- **Admin:** Yes
- **Example:** `.addDeleteReact 🗑️`

**`.removeDeleteReact`**

- **Description:** Remove a react-to-delete emoji by the same emoji string or by 1-based index (indices appear under **React to delete** in `.listReacts`).
- **Usage:** `.removeDeleteReact <emoji>` or `.removeDeleteReact <index>`
- **Admin:** Yes
- **Example:** `.removeDeleteReact 🗑️`

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

- **Description:** Scan a channel’s message history for world links and process them with duplicate logic.
- **Usage:** `.crawlHistory #channel`
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

- **Description:** In a **watched** channel, remove duplicate-tracking for a world whose link appears in the same message (lets that world be posted again as “new” in this guild). Does not unwatch channels or delete forwarded copies.
- **Usage:** `.remove <message containing a world link>` (e.g. paste the world URL in the command line)
- **Admin:** Yes
- **Example:** `.remove https://vrchat.com/home/world/wrld_...`

**`.die`**

- **Description:** Shut down the bot process gracefully.
- **Usage:** `.die`
- **Admin:** Yes
- **Example:** `.die`

## Data Storage

The bot stores its state in `db.json` (watched channels, forwarding channels, processed worlds, etc.). This file is created automatically.

## Documentation

- **World link processing** — [manual/world-link-processing.md](manual/world-link-processing.md) — detection, duplicates, embed reply, and criteria-based forwarding (with diagrams).
- **Reaction forwarding** — [manual/reaction-forwarding.md](manual/reaction-forwarding.md) — setup, react-to-delete, and reaction handler flows (with diagrams).

## Scripts

- **`scripts/backup-db.sh`** — Backs up `db.json` to a configurable directory. Edit `SOURCE` and `BACKUP_DIR` before use. Removes backups older than 7 days.
- **`scripts/delete-stale-logs.sh`** — Deletes compressed log files older than 7 days. Edit `LOG_DIR` (or `BACKUP_DIR` if used for logs) before use.

## Tech Stack

- **TypeScript** — Main language
- **Discord.js** — Discord API
- **vrchat** — VRChat API client
- **keyv-file** — File-based key-value storage
- **tslog** — Logging with rotating file output
- **fastest-levenshtein** — Fuzzy string matching for world/author resolution from tweets

## License

ISC
