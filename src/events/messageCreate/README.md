# Message Create Commands

This directory contains handlers for messages in Discord channels. Routing lives in [`index.ts`](index.ts): lines that start with documented dot-commands invoke the matching handler; everything else is passed to [`watchForVRCWorldLinks`](watchForVRCWorldLinks/index.ts).

**User-facing reference with diagrams:** [World link processing](../../../manual/world-link-processing.md) · [Reaction forwarding](../../../manual/reaction-forwarding.md) · [Root README commands](../../../README.md#commands)

## Available Commands

Unless noted, commands use [`withProtection`](wrappers/withProtection.ts) (Discord user ID must be in `ADMIN_ID`). Most channel-targeting commands use the **first channel mention** in the message (`message.mentions.channels.first()`).

### Channel watching

#### `.watch`

- **Description:** Add a channel to `WATCHED_CHANNELS` so world links there get embeds, duplicate handling, and automatic forwarding.
- **Usage:** `.watch #channel`
- **Admin:** Yes
- **Example:** `.watch #vrchat-worlds`
- **Handler:** [`watchChannel.ts`](watchChannel.ts)

#### `.unwatch`

- **Description:** Remove a channel from `WATCHED_CHANNELS`.
- **Usage:** `.unwatch #channel`
- **Admin:** Yes
- **Example:** `.unwatch #vrchat-worlds`
- **Handler:** [`unWatchChannel.ts`](unWatchChannel.ts)

### Automatic forwarding (world criteria)

Each handler updates one forwarding destination via [`setForwardingChannel`](forwarding/setForwardingChannel.ts). Multiple rules can match a single world; see [`getForwardingChannels`](watchForVRCWorldLinks/forwarding/index.ts).

#### `.forwardAndroid`

- **Description:** Set the Android-support forwarding destination.
- **Usage:** `.forwardAndroid #channel`
- **Admin:** Yes
- **Example:** `.forwardAndroid #android-worlds`
- **Handler:** [`forwarding/androidSupport.ts`](forwarding/androidSupport.ts)

#### `.forwardMaxSlots`

- **Description:** Set the high-capacity forwarding destination (capacity ≥ `FORWARD_PLAYER_COUNT_THRESHOLD`).
- **Usage:** `.forwardMaxSlots #channel`
- **Admin:** Yes
- **Example:** `.forwardMaxSlots #big-worlds`
- **Handler:** [`forwarding/maxSlots.ts`](forwarding/maxSlots.ts)

#### `.forwardLowCap`

- **Description:** Set the low-capacity forwarding destination (capacity ≤ `LOW_CAPACITY_THRESHOLD`).
- **Usage:** `.forwardLowCap #channel`
- **Admin:** Yes
- **Example:** `.forwardLowCap #small-worlds`
- **Handler:** [`forwarding/lowCapacity.ts`](forwarding/lowCapacity.ts)

#### `.clearForwardingChannels`

- **Description:** Clear Android, high-cap, and low-cap forwarding keys only (not watched channels or reaction config).
- **Usage:** `.clearForwardingChannels`
- **Admin:** Yes
- **Handler:** [`forwarding/clearForwardingChannels.ts`](forwarding/clearForwardingChannels.ts)

### Reaction forwarding and cleanup

#### `.watchReacts`

- **Description:** Add a channel to `WATCHED_REACTION_CHANNELS` for emoji-triggered forwards and react-to-delete.
- **Usage:** `.watchReacts #channel`
- **Admin:** Yes
- **Example:** `.watchReacts #inbox`
- **Handler:** [`watchReacts.ts`](watchReacts.ts)

#### `.unwatchReacts`

- **Description:** Remove a channel from `WATCHED_REACTION_CHANNELS`.
- **Usage:** `.unwatchReacts #channel`
- **Admin:** Yes
- **Handler:** [`unwatchReacts.ts`](unwatchReacts.ts)

#### `.forwardReact`

- **Description:** Map an emoji string to a destination channel ID in `REACTION_FORWARD_CHANNELS`.
- **Usage:** `.forwardReact <emoji> #channel`
- **Admin:** Yes
- **Handler:** [`forwarding/forwardReact.ts`](forwarding/forwardReact.ts)

#### `.listReacts`

- **Description:** Embed listing forward mappings and `REACT_TO_DELETE_EMOJIS` with indices.
- **Usage:** `.listReacts`
- **Admin:** Yes
- **Handler:** [`forwarding/listReacts.ts`](forwarding/listReacts.ts)

#### `.removeReact`

- **Description:** Remove a forward mapping by emoji key or 1-based index (forward list order).
- **Usage:** `.removeReact <emoji or index>`
- **Admin:** Yes
- **Handler:** [`forwarding/removeReact.ts`](forwarding/removeReact.ts)

#### `.addDeleteReact`

- **Description:** Append an emoji to `REACT_TO_DELETE_EMOJIS` (react-to-delete on bot messages in watched react channels).
- **Usage:** `.addDeleteReact <emoji>`
- **Admin:** Yes
- **Handler:** [`addDeleteReact.ts`](addDeleteReact.ts)

#### `.removeDeleteReact`

- **Description:** Remove a react-to-delete emoji by exact stored string or 1-based index into the delete list.
- **Usage:** `.removeDeleteReact <emoji or index>`
- **Admin:** Yes
- **Handler:** [`removeDeleteReact.ts`](removeDeleteReact.ts)

### World data and history

#### `.export`

- **Description:** CSV export of processed worlds without per-world API calls.
- **Usage:** `.export`
- **Admin:** No
- **Handler:** [`export.ts`](export.ts)

#### `.exportFull`

- **Description:** Rich CSV with VRChat API lookups and progress messaging.
- **Usage:** `.exportFull`
- **Admin:** Yes
- **Handler:** [`export.ts`](export.ts)

#### `.crawlHistory`

- **Description:** Historical scan of a text channel for world links. Supports three modes:
  - **Default (discover):** Finds new worlds and processes them with duplicate logic.
  - **`--tags`:** Rebuilds tags and `source_content` from message history for already-discovered worlds.
  - **`--quality good|bad`:** Assigns a quality rating to already-discovered worlds.
  Crawls are resumable if interrupted, and can be cancelled by reacting with ❌ on the progress message.
- **Usage:** `.crawlHistory #channel [--tags | --quality good|bad]`
- **Admin:** Yes
- **Handler:** [`crawlHistory.ts`](crawlHistory.ts)

#### `.crawlStatus`

- **Description:** Read `CHANNEL_HISTORY_CRAWL_STATUS` for a mentioned channel.
- **Usage:** `.crawlStatus #channel`
- **Admin:** No
- **Handler:** [`crawlHistory.ts`](crawlHistory.ts) (`getCrawlStatus`)

### Maintenance

#### `.stats`

- **Description:** Guild/channel stats; only responds in watched channels (see [`stats.ts`](stats.ts)).
- **Usage:** `.stats`
- **Admin:** No
- **Handler:** [`stats.ts`](stats.ts)

#### `.remove`

- **Description:** In a **watched** channel, parses a world ID from `message.content` and removes the `PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID` entry for `{worldId}-{guildId}`. Does not unwatch the channel or remove forwarded messages.
- **Usage:** `.remove …` with a world URL or parsable world reference in the same message
- **Admin:** Yes
- **Example:** `.remove https://vrchat.com/home/world/wrld_abc123`
- **Handler:** [`remove.ts`](remove.ts)

#### `.die`

- **Description:** Acknowledge and `process.exit(0)`.
- **Usage:** `.die`
- **Admin:** Yes
- **Handler:** [`die.ts`](die.ts)

## Manual testing for `.forwardReact`

- Set a mapping: `.forwardReact 😀 #target-channel` and confirm the bot’s confirmation text.
- Override: run the same emoji with another channel and confirm the update message.
- Inspect `REACTION_FORWARD_CHANNELS` in `db.json` for the stored emoji key and channel ID.

## Command protection

[`withProtection`](wrappers/withProtection.ts) silently ignores non-admin authors for protected commands.

**Unprotected (by design):** `.stats`, `.export`, `.crawlStatus` — read-oriented or low-risk. **Protected:** `.exportFull`, `.crawlHistory`, and all other admin configuration commands above.

## Automatic processing

When no command prefix matches, [`watchForVRCWorldLinks`](watchForVRCWorldLinks/index.ts) runs: watched channel check, content extraction (including forward snapshots), world ID extraction, duplicate handling, embed reply, and optional forwards per [`getForwardingChannels`](watchForVRCWorldLinks/forwarding/index.ts).
