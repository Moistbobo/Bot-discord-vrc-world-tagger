---
name: create-custom-matcher
description: Generates a customMatcher entry for Twitter world and author extraction from one or more example tweet contents. Use when the user provides example tweet text(s) to support a new Twitter account format, when existing regex rules fail for a specific account, or when the user asks to add a custom matcher for the sos-world-tagger-api extraction module.
---

# Create custom matcher

Adds a new entry to `customMatchers` in the **sos-world-tagger-api** repo's
`src/extraction/regex.ts` so the API can extract VRChat world name and author
from tweets whose format is not covered by the default regex or line-based
logic. The bot delegates all extraction to the API (`POST /api/worlds/extract`).

## Inputs

- **Required**: One or more example tweet content strings (the raw tweet text where world name and author name appear). Multiple examples let the agent infer a single pattern that works for all.
- **Required**: Twitter link or username for the account that uses this format. Used to build the matcher key. If missing, ask the user for the Twitter username or an example link.
- **Optional**: If the world and author name is not clear from the input, ask the user for clarification.

## Target

- **Repo**: `sos-world-tagger-api` (sibling of `bot_vrc_world_tagger`)
- **File**: `src/extraction/regex.ts`
- **Object**: `customMatchers` (add one new key-value entry)

## Matcher shape

- **Key**: String used as `new RegExp(key, 'i')` and tested against the **full Twitter link** (e.g. `https://x.com/Username/status/123`). Usually the Twitter username (e.g. `n4rGm5DmrVXXz6I`). Escape regex special characters if the key contains `.`, `*`, etc.
- **Value**: Object with:
  - `getWorldName(content: string) => string | null`
  - `getAuthorName(content: string) => string | null`
  - Both must: guard `if (!content) return null;`, trim results, return `null` when nothing is found.

## Workflow

1. **Parse all example tweets** – For each string, identify where the world name and author name appear (line index, label prefix, delimiter, etc.). Infer a **common pattern** that fits every example.
2. **Choose the matcher key** – From the user-provided Twitter link or username. If not provided, ask: "What is the Twitter username or an example link for this account?"
3. **Implement extractors** – Write `getWorldName` and `getAuthorName` so they correctly extract from every example. Use the same logic for all (e.g. "first line / second line", or a regex that matches the shared structure). Verify mentally or in a comment that each example yields the right world and author.
4. **Add to customMatchers** – Insert the new entry in `src/extraction/regex.ts` following the style of the existing entry (e.g. `n4rGm5DmrVXXz6I`). Preserve existing keys and formatting.
5. **Verify** – Run `pnpm test` in the API repo (the extraction tests live in `src/extraction/regex.test.ts`).

## Constraints

- Use forward slashes in paths (e.g. `src/extraction/regex.ts`).
- Escape regex special characters when building patterns from user content: `.*+?^${}()|[\]\\`.
- Extractors must be defensive: null/empty check, trim, return null on no match.

## Reference in repo

Existing matcher pattern in `sos-world-tagger-api/src/extraction/regex.ts`:

```ts
export const customMatchers = {
  n4rGm5DmrVXXz6I: {
    getWorldName: (content: string) => {
      if (!content) return null;
      return content.split('\n')[0].trim();
    },
    getAuthorName: (content: string) => {
      if (!content) return null;
      return content.split('\n')[1].trim();
    }
  }
};
```

For more "tweet in → matcher out" examples, see [examples.md](examples.md).
