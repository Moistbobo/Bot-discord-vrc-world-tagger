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

/**
 * Regex patterns for structured tag lines (case-insensitive).
 * Matches prefixes like "Tags:", "Tag:", "Category:", etc.
 */
const STRUCTURED_PREFIXES = [
  /^tags?\s*[:：]\s*/i,
  /^tag\(s\)\s*[:：]\s*/i,
  /^categories?\s*[:：]\s*/i,
  /^types?\s*[:：]\s*/i,
  /^map types?\s*[:：]\s*/i
];

/**
 * Regex for Japanese tag prefixes.
 */
const JP_PREFIXES = [
  /^タグ\s*[:：]\s*/i,
  /^種類\s*[:：]\s*/i,
  /^カテゴリー\s*[:：]\s*/i
];

const ALL_PREFIXES = [...STRUCTURED_PREFIXES, ...JP_PREFIXES];

/**
 * Extract hashtags from content.
 */
function extractHashtags(content: string): string[] {
  const matches = content.match(
    /#[\w\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf]+/g
  );
  if (!matches) return [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const normalized = raw.slice(1).toLowerCase().trim();
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

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

/**
 * Extract tags from inline / loose prose using whole-word matching.
 * Only matches complete words/phrases, not substrings (e.g. "game" won't match "gamergate").
 * Respects first-appearance order in the text.
 */
function extractInlineTags(content: string): string[] {
  // Build a map of all matchable patterns → canonical tag
  const patternToCanonical = new Map<string, string>();

  for (const tag of TAXONOMY) {
    patternToCanonical.set(tag, tag);
  }
  for (const [variant, canonical] of Object.entries(CANONICAL_MAP)) {
    patternToCanonical.set(variant, canonical);
  }

  // Sort by length descending so longer phrases match first
  // (prevents "game" matching before "gamerip")
  const sortedPatterns = Array.from(patternToCanonical.entries()).sort(
    (a, b) => b[0].length - a[0].length
  );

  const found = new Map<string, number>(); // canonical tag → first match index

  for (const [pattern, canonicalTag] of sortedPatterns) {
    if (found.has(canonicalTag)) continue;

    const words = pattern.split(/\s+/);
    const escapedWords = words.map((w) =>
      w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const regexPattern = escapedWords.join('[\\s/\\-]*');
    const regex = new RegExp(
      '(?:^|[^\\w])' + regexPattern + '(?:[^\\w]|$)',
      'i'
    );

    const match = regex.exec(content);
    if (match) {
      found.set(canonicalTag, match.index);
    }
  }

  return Array.from(found.entries())
    .sort((a, b) => a[1] - b[1])
    .map(([tag]) => tag);
}

/**
 * Apply canonicalization map. If a token maps to a canonical form, replace it.
 */
function canonicalize(token: string): string {
  return CANONICAL_MAP[token] ?? token;
}

/**
 * Validate a token against the taxonomy. Returns the canonical tag if valid,
 * null otherwise.
 */
function validate(token: string): string | null {
  const canonical = canonicalize(token);
  if (TAXONOMY.has(canonical)) {
    return canonical;
  }
  logger.debug(
    `Tag extraction: "${token}" (canonical: "${canonical}") not in taxonomy`
  );
  return null;
}

/**
 * Main entry point: extract validated taxonomy tags from arbitrary content.
 *
 * Uses multiple strategies in order:
 * 1. Hashtag pass (#horror)
 * 2. Structured prefix pass (Tags: horror)
 * 3. Inline / loose prose pass (whole-word matching)
 *
 * Results are canonicalized, validated against taxonomy, and deduplicated
 * in order of first appearance across all passes.
 */
export function extractTags(content: string): string[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  const passes = [
    extractHashtags(content),
    extractStructuredTags(content),
    extractInlineTags(content)
  ];

  for (const pass of passes) {
    for (const token of pass) {
      const validated = validate(token);
      if (!validated) continue;
      if (seen.has(validated)) continue;

      seen.add(validated);
      result.push(validated);
    }
  }

  logger.debug(`Extracted tags from content: ${JSON.stringify(result)}`);
  return result;
}
