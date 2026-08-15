const VRCHAT_WORLD_ID_REGEX = /wrld_[a-f0-9-]{36}/;

export function extractWorldId(message: string): string | null {
  if (!message) return null;
  const match = message.match(VRCHAT_WORLD_ID_REGEX);
  return match?.[0] ?? null;
}

/**
 * Returns every unique VRChat world id found in `text`, in order of first appearance.
 */
export function extractAllWorldIds(text: string): string[] {
  if (!text) return [];
  const re = new RegExp(VRCHAT_WORLD_ID_REGEX.source, 'g');
  const matches = text.match(re);
  if (!matches?.length) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of matches) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

/**
 * Removes all URLs and VRChat world IDs from content, leaving only user-typed text.
 * Useful for tag extraction from Discord message content.
 */
export function cleanContentForTagExtraction(content: string): string {
  if (!content || typeof content !== 'string') return '';
  return content
    .replace(/https?:\/\/[^\s]+|www\.[^\s]+/gi, ' ')
    .replace(/wrld_[a-f0-9-]{36}/gi, ' ')
    .replace(/[ \t]+/g, ' ') // collapse horizontal whitespace only
    .replace(/\n[ \t]*/g, '\n') // trim leading spaces from each line
    .replace(/[ \t]*\n/g, '\n') // trim trailing spaces from each line
    .trim();
}
