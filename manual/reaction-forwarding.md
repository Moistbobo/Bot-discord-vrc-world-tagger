# Reaction forwarding

## Overview

Reaction forwarding lets admins watch specific channels and map emojis to destination channels. When someone (non-bot) adds a configured emoji to a message in a watched channel, the bot forwards that message to the mapped channel. Useful for "save to channel" workflows (e.g. react with a bookmark emoji to send a copy to an archive channel).

## Prerequisites

All reaction-forwarding commands require admin (user ID in `ADMIN_ID`). No special Discord permissions beyond what the bot already needs.

## Setup

1. Watch one or more source channels: `.watchReacts #source-channel` (repeat for multiple channels).
2. Map an emoji to a destination: `.forwardReact <emoji> #destination-channel` (e.g. `.forwardReact 📌 #saved`).
3. Verify with `.listReacts`.

## Commands reference

| Command | Description |
|---------|-------------|
| `.watchReacts #channel` | Watch a channel for reaction-based forwarding. Reactions in this channel can trigger forwards. |
| `.unwatchReacts #channel` | Stop watching a channel for reaction forwarding. |
| `.forwardReact <emoji> #channel` | Map an emoji to a channel. When someone reacts with this emoji in a watched channel, the message is forwarded to the target channel. |
| `.listReacts` | List current emoji → channel mappings. |
| `.removeReact <emoji>` | Remove the forwarding mapping for an emoji. |

## How it works

- **Watched channels only** — A forward triggers only when the message is in a channel that has been added with `.watchReacts`. Reactions in other channels are ignored.
- **One forward per message** — Only the first reaction that matches a configured emoji forwards the message. The message ID is stored so the same message is never forwarded again, even if more people react with the same emoji.
- **Same-channel safeguard** — If the target channel is the same as the channel containing the message, the bot does not forward. This avoids infinite loops when someone reacts to an already-forwarded message in the destination channel.
- **Old messages** — Works on messages sent before the bot was online. Uncached messages are fetched when the reaction event fires.
- **Large messages** — If Discord rejects the forward due to message size (e.g. attachments over the limit), the bot sends a link to the original message in the target channel instead.

## Emoji support

Unicode emojis (e.g. 😀, 📌) and Discord custom emojis are supported. When removing a mapping with `.removeReact`, use the same emoji form as when you added it (e.g. the exact emoji string).

## Stored data

Configuration is stored in `db.json`:

- **REACTION_FORWARD_CHANNELS** — Mapping of emoji (as stored by the bot) to destination channel IDs.
- **WATCHED_REACTION_CHANNELS** — List of channel IDs that are watched for reaction forwarding.
- **REACTION_FORWARDED_MESSAGE_IDS** — Message IDs that have already been forwarded (so each message is only forwarded once).

You do not need to edit these by hand for normal use.
