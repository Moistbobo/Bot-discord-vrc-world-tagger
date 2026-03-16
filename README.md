# VRC World Tagger Bot

A Discord bot that monitors channels for VRChat world links and automatically enriches them with world metadata—including name, author, capacity, platform support, and download sizes. It can also forward worlds to specialized channels based on criteria like Android support or player capacity.

## Features

- **World link detection** — Detects VRChat world links in messages (direct links and links shared via Twitter/X)
- **Rich embeds** — Replies with Discord embeds showing world name, author, max slots, supported platforms (PC, Quest, Android), and download sizes
- **Channel watching** — Watch specific channels for world links; unwatched channels are ignored
- **Smart forwarding** — Automatically forwards worlds to dedicated channels when they meet criteria:
  - **Android support** — Worlds that support Android/Quest
  - **High capacity** — Worlds with player count above a configurable threshold (default: 40)
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
npm install
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

## Usage

### Start the bot

```bash
npm start
```

### Commands

All commands require admin privileges (user ID in `ADMIN_ID`), except where noted.

| Command | Description |
|---------|-------------|
| `.watch` | Start watching the current channel for VRC world links |
| `.unwatch` | Stop watching the current channel |
| `.forwardAndroid` | Set the current channel as the Android-support forwarding destination |
| `.forwardMaxSlots` | Set the current channel as the high-capacity forwarding destination |
| `.forwardLowCap` | Set the current channel as the low-capacity forwarding destination |
| `.clearForwardingChannels` | Clear all forwarding channel settings |
| **Reaction forwarding** | |
| `.watchReacts #channel` | Watch a channel for reaction-based forwarding (react with configured emoji to forward messages) |
| `.unwatchReacts #channel` | Stop watching a channel for reaction forwarding |
| `.forwardReact <emoji> #channel` | Map an emoji to a channel; reacting with that emoji in a watched channel forwards the message to the target channel |
| `.listReacts` | List current reaction-forwarding mappings |
| `.removeReact <emoji or index>` | Remove reaction forwarding for an emoji, or by index from `.listReacts` |
| **Other** | |
| `.remove` | Remove the bot from the current channel (unwatch + clear forwarding) |
| `.stats` | Show statistics (no admin required) |
| `.export` | Export watched worlds data |
| `.exportFull` | Full export with additional processing |
| `.crawlHistory` | Crawl channel history for world links |
| `.crawlStatus` | Check status of an ongoing crawl |
| `.die` | Shut down the bot |

## Data Storage

The bot stores its state in `db.json` (watched channels, forwarding channels, processed worlds, etc.). This file is created automatically.

## Documentation

- **Reaction forwarding** — See [manual/reaction-forwarding.md](manual/reaction-forwarding.md) for setup and behavior.

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
