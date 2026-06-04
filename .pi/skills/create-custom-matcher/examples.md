# Examples: tweet content → customMatcher entry

## Example 1: Line-based (world on first line, author on second)

**Example tweet 1:**
```
Tokyo Mood by BEAMS Summer Version
BEAMS_STAFF_1
```

**Example tweet 2:**
```
Midnight Rooftop
VRC_Creator_42
```

**Inferred pattern:** World name = first non-empty line; author = second non-empty line. Same logic works for both.

**Matcher entry** (key = Twitter username, e.g. `SomeAccount`):

```ts
SomeAccount: {
  getWorldName: (content: string) => {
    if (!content) return null;
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines[0] ?? null;
  },
  getAuthorName: (content: string) => {
    if (!content) return null;
    const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
    return lines[1] ?? null;
  }
}
```

---

## Example 2: Label-based (e.g. "World: ..." and "By: ...")

**Example tweet 1:**
```
World: Cozy Cafe 2024
By: AliceVR
```

**Example tweet 2:**
```
World: Space Station Alpha
By: Bob_Worlds
```

**Inferred pattern:** World after "World:" (with optional colon); author after "By:". Handle both regular and full-width colons if needed.

**Matcher entry** (key = Twitter username):

```ts
LabeledAccount: {
  getWorldName: (content: string) => {
    if (!content) return null;
    const match = content.match(/World\s*[:：]\s*([^\n]+)/i);
    return match?.[1]?.trim() ?? null;
  },
  getAuthorName: (content: string) => {
    if (!content) return null;
    const match = content.match(/By\s*[:：]\s*([^\n]+)/i);
    return match?.[1]?.trim() ?? null;
  }
}
```

When adding to `customMatchers`, replace the key with the actual Twitter username (or pattern) the user provides, and ensure the same extractors work for every example tweet they gave.
