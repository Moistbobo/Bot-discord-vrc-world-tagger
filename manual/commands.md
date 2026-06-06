# Manual — VRC World Tagger Bot

This folder holds deeper documentation for how the bot behaves. This page is a **quick reference for Discord dot-commands**: what they do, who can use them, and copy-paste-style examples.

## Related docs

- [World link processing](world-link-processing.md) — detection, duplicates, embeds, criteria-based forwarding (with diagrams).
- [Reaction forwarding](reaction-forwarding.md) — emoji→channel forwarding, react-to-delete, handler flows (with diagrams).

## How commands work

- Send commands as normal messages in a **text channel** the bot can read.
- **Admin commands** require your Discord user ID in the `ADMIN_ID` environment variable (comma-separated). If you are not an admin, protected commands are **silently ignored** (no reply).
- When a command needs a channel, **mention it** with `#`. The bot uses the **first channel mention** in the message.
- **Routing note:** `.exportFull` is matched before `.export`, so messages must start with `.exportFull` for the full export (not `.export` with extra text).

## Command list

### Opt out / opt in (any user, not bots)

| Command | Admin | Description | Example |
|--------|-------|-------------|---------|
| `.ignoreMe` | No | Adds you to the ignore list; the bot stops processing your messages and reactions until you opt back in. | `.ignoreMe` |
| `.unignoreMe` | No | Removes you from the ignore list. While ignored, this is the **only** command the bot still handles for you. | `.unignoreMe` |

### Channel watching

| Command | Admin | Description | Usage | Example |
|--------|-------|-------------|-------|---------|
| `.watch` | Yes | Watch a channel for VRChat world links (embeds, duplicate tracking, automatic forwarding). | `.watch #channel` | `.watch #vrchat-worlds` |
| `.unwatch` | Yes | Stop watching a channel for world links. | `.unwatch #channel` | `.unwatch #vrchat-worlds` |

### Automatic forwarding (world criteria)

Each command sets **one** destination for that rule. A single world can match several rules and be forwarded to **several** channels in one pass.

| Command | Admin | Description | Usage | Example |
|--------|-------|-------------|-------|---------|
| `.forwardAndroid` | Yes | Forward worlds with Android/Quest support to a channel. | `.forwardAndroid #channel` | `.forwardAndroid #android-worlds` |
| `.forwardMaxSlots` | Yes | Forward high-capacity worlds (capacity ≥ `FORWARD_PLAYER_COUNT_THRESHOLD`, default 40). | `.forwardMaxSlots #channel` | `.forwardMaxSlots #big-venues` |
| `.forwardLowCap` | Yes | Forward low-capacity worlds (capacity ≤ `LOW_CAPACITY_THRESHOLD`, default 20). | `.forwardLowCap #channel` | `.forwardLowCap #small-worlds` |
| `.clearForwardingChannels` | Yes | Clear all automatic forwarding destinations (Android, high-cap, low-cap). Does **not** change watched channels or reaction settings. | `.clearForwardingChannels` | `.clearForwardingChannels` |

### Reaction forwarding and cleanup

See [reaction-forwarding.md](reaction-forwarding.md) for setup and behavior details.

| Command | Admin | Description | Usage | Example |
|--------|-------|-------------|-------|---------|
| `.watchReacts` | Yes | Allow reactions in a channel to trigger emoji→channel forwarding (after mapping with `.forwardReact`). | `.watchReacts #channel` | `.watchReacts #inbox` |
| `.unwatchReacts` | Yes | Stop watching a channel for reaction-based forwarding. | `.unwatchReacts #channel` | `.unwatchReacts #inbox` |
| `.forwardReact` | Yes | Map an emoji to a destination; in watched react channels, that reaction forwards the message (once per message). | `.forwardReact <emoji> #channel` | `.forwardReact 📌 #saved` |
| `.listReacts` | Yes | List channels with `.watchReacts`, emoji→channel mappings, and react-to-delete emojis (with indices for removal). | `.listReacts` | `.listReacts` |
| `.removeReact` | Yes | Remove a forward mapping by emoji or by **1-based** index from `.listReacts`. | `.removeReact <emoji>` or `.removeReact <index>` | `.removeReact 1` |
| `.addDeleteReact` | Yes | Register an emoji so reacting with it on **the bot’s messages** deletes them (in `.watchReacts` channels). | `.addDeleteReact <emoji>` | `.addDeleteReact 🗑️` |
| `.removeDeleteReact` | Yes | Remove a react-to-delete emoji by emoji or **1-based** index (indices under **React to delete** in `.listReacts`). | `.removeDeleteReact <emoji>` or `.removeDeleteReact <index>` | `.removeDeleteReact 🗑️` |
| `.setQualityChannel` | Yes | Mark a channel as a quality-tracking destination. When a world is reaction-forwarded to that channel, the bot records its quality (`good` or `bad`) in the database. Only one channel per quality at a time. | `.setQualityChannel <good|bad> #channel` | `.setQualityChannel good #good-maps` |
| `.clearQualityChannel` | Yes | Clear the quality-channel assignment for `good` or `bad`. After clearing, worlds forwarded to that channel won't have quality recorded. | `.clearQualityChannel <good|bad>` | `.clearQualityChannel bad` |

### World data and history

| Command | Admin | Description | Usage | Example |
|--------|-------|-------------|-------|---------|
| `.export` | No | Export a CSV of processed world IDs and URLs (no live VRChat API call per world). | `.export` | `.export` |
| `.exportFull` | Yes | Export a detailed CSV with live VRChat API data per world; rate-limited and heavier. | `.exportFull` | `.exportFull` |
| `.crawlHistory` | Yes | Scan a channel’s history for world links. Supports three modes:
  - **Default (discover):** Finds new worlds and processes them with duplicate logic.
  - **`--tags`:** Rebuilds tags and `source_content` from message history for already-discovered worlds.
  - **`--quality good|bad`:** Assigns a quality rating to already-discovered worlds.
  Crawls are resumable if interrupted, and can be cancelled by reacting with ❌ on the progress message. | `.crawlHistory #channel [--tags | --quality good|bad]` | `.crawlHistory #vrchat-worlds`
`.crawlHistory #vrchat-worlds --tags`
`.crawlHistory #vrchat-worlds --quality good` |
| `.crawlStatus` | No | Show crawl progress or completion for a channel. | `.crawlStatus #channel` | `.crawlStatus #vrchat-worlds` |

### Maintenance

| Command | Admin | Description | Usage | Example |
|--------|-------|-------------|-------|---------|
| `.stats` | No | Show bot statistics (**only** in channels that are watched with `.watch`). | `.stats` | `.stats` |
| `.remove` | Yes | In a **watched** channel, clear duplicate tracking for a world whose link appears in the message so it can be treated as new again in this guild. Does not unwatch or delete forwarded copies. | `.remove` + world URL in the same message | `.remove https://vrchat.com/home/world/wrld_...` |
| `.die` | Yes | Shut down the bot process gracefully. | `.die` | `.die` |

## Anything that is not a command

Messages that do **not** start with one of the prefixes above are handled as normal content: in watched channels, the bot runs world-link detection, embeds, duplicates, and forwarding as documented in [world-link-processing.md](world-link-processing.md).

## Project README

Installation, environment variables, and scripts are in the repository root [README.md](../README.md).
