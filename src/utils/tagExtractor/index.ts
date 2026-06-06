import logger from '../logger';

/**
 * Canonical taxonomy tags for VRChat world categorization.
 */
const TAXONOMY = new Set<string>([
  'kino',
  'chill',
  'comfy',
  'adventure',
  'horror',
  'game',
  'particle live / vrmv',
  'gallery',
  'meme',
  'puzzle',
  'driving',
  'tech',
  'nature',
  'gamerip',
  'portal'
]);

/**
 * Maps variant spellings / synonyms to their canonical taxonomy form.
 */
const CANONICAL_MAP: Record<string, string> = {
  'particle live': 'particle live / vrmv',
  particlelive: 'particle live / vrmv',
  vrmv: 'particle live / vrmv',
  パーティクルライブ: 'particle live / vrmv'
};

/** Regex patterns for structured tag lines (case-insensitive). */
const ALL_PREFIXES = [
  /^tags?\s*[:：]\s*/i,
  /^tag\(s\)\s*[:：]\s*/i,
  /^categor(?:y|ies)\s*[:：]\s*/i,
  /^types?\s*[:：]\s*/i,
  /^map types?\s*[:：]\s*/i,
  /^タグ\s*[:：]\s*/i,
  /^種類\s*[:：]\s*/i,
  /^カテゴリー\s*[:：]\s*/i
];

/**
 * Extract tags from structured prefix lines.
 * e.g. "Tags: horror, game" or "Tags: horror game chill"
 */
function extractStructuredTags(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    for (const prefix of ALL_PREFIXES) {
      const match = line.match(prefix);
      if (!match) continue;

      const afterPrefix = line.slice(match[0].length).trim();
      if (!afterPrefix) continue;

      // Try the entire post-prefix string as a single tag first
      // (handles multi-word tags like "particle live" before splitting)
      const whole = afterPrefix
        .toLowerCase()
        .replace(/^[([{'"`]+/, '')
        .replace(/[)\]}'"`]+$/, '');
      const wholeValidated = validate(whole);
      if (wholeValidated && !seen.has(wholeValidated)) {
        seen.add(wholeValidated);
        result.push(wholeValidated);
        break;
      }

      const tokens = afterPrefix
        .split(/[,，、\s]+/)
        .map((t) => t.trim().toLowerCase())
        .map((t) => t.replace(/^[([{'"`]+/, '').replace(/[)\]}'"`]+$/, ''))
        .filter((t) => t.length > 0);

      for (const token of tokens) {
        if (seen.has(token)) continue;
        seen.add(token);
        result.push(token);
      }

      break; // only one prefix per line
    }
  }

  return result;
}

/** Apply canonicalization map. */
function canonicalize(token: string): string {
  return CANONICAL_MAP[token] ?? token;
}

/** Validate a token against the taxonomy. */
function validate(token: string): string | null {
  const canonical = canonicalize(token);
  if (TAXONOMY.has(canonical)) {
    return canonical;
  }
  return null;
}

/**
 * Main entry point: extract validated taxonomy tags from structured tag lines.
 *
 * Looks for lines starting with known prefixes (Tags:, Tag:, Category:, etc.)
 * and validates the comma/space-separated tokens against the taxonomy.
 */
export function extractTags(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const token of extractStructuredTags(content)) {
    const validated = validate(token);
    if (!validated) continue;
    if (seen.has(validated)) continue;

    seen.add(validated);
    result.push(validated);
  }

  logger.debug(`Extracted tags from content: ${JSON.stringify(result)}`);
  return result;
}
