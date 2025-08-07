import Config from '../assets/config';

const VRCHAT_WORLD_LINK_REGEX =
  /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}/;
const VRCHAT_WORLD_ID_REGEX = /wrld_[a-f0-9-]{36}/;
const VRCHAT_LINK_REMOVE_REGEX =
  /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}(\/\S*)?/;
const GENERIC_LINK_REGEX = /https?:\/\/\S+/;
const TWITTER_LINK_REGEX =
  /(?:https?:\/\/)?(?:x\.com|fixupx\.com|vxtwitter\.com)\/([^?\s]+)/;
const FILE_ID_REGEX = /file_([a-f0-9-]+)/;

// Configurable terms for world name extraction
const WORLD_TERMS = Config.WORLD_NAME_MATCHERS;

// Configurable terms for author name extraction
const AUTHOR_TERMS = Config.AUTHOR_NAME_MATCHERS;

export function extractWorldLink(message: string): string | null {
  if (!message) return null;
  const match = message.match(VRCHAT_WORLD_LINK_REGEX);
  return match?.[0] ?? null;
}

export function extractWorldId(message: string): string | null {
  if (!message) return null;
  const match = message.match(VRCHAT_WORLD_ID_REGEX);
  return match?.[0] ?? null;
}

export function removeVRChatLink(message: string): string | null {
  if (!message) return null;
  return message.replace(VRCHAT_LINK_REMOVE_REGEX, '').trim() || null;
}

export function getLinkFromMessage(message: string): string | null {
  if (!message) return null;
  const match = message.match(GENERIC_LINK_REGEX);
  return match?.[0] ?? null;
}

export function removeTwitterLink(link: string): string | null {
  if (!link) return null;
  const match = link.match(TWITTER_LINK_REGEX);
  return match?.[1] ?? null;
}

export function getFileIdFromAssetUrl(assetUrl: string): string | null {
  if (!assetUrl) return null;
  const match = assetUrl.match(FILE_ID_REGEX);
  return match?.[1] ?? null;
}

/**
 * Extracts world name from message content using configurable terms
 * @param message - The message content to search
 * @param customTerms - Optional array of additional terms to match
 * @returns The world name if found, null otherwise
 */
export function extractWorldName(
  message: string,
  customTerms: string[] = []
): string | null {
  if (!message) return null;

  const allTerms = [...WORLD_TERMS, ...customTerms];
  const termsPattern = allTerms
    .map(
      (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
    )
    .join('|');

  // More flexible regex that handles various formats including Japanese
  const worldNameRegex = new RegExp(
    `(?:${termsPattern})\\s*:?\\s*([^\\n\\r#]+?)(?=\\s*(?:${AUTHOR_TERMS.join('|')})|\\s*#|\\s*$|\\s*\\n)`,
    'i'
  );

  const match = message.match(worldNameRegex);

  return match?.[1]?.trim() ?? null;
}

/**
 * Extracts author name from message content using configurable terms
 * @param message - The message content to search
 * @param customTerms - Optional array of additional terms to match
 * @returns The author name if found, null otherwise
 */
export function extractAuthorName(
  message: string,
  customTerms: string[] = []
): string | null {
  if (!message) return null;

  const allTerms = [...AUTHOR_TERMS, ...customTerms];
  const termsPattern = allTerms
    .map(
      (term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex special characters
    )
    .join('|');

  // More flexible regex that handles various formats including Japanese
  const authorNameRegex = new RegExp(
    `(?:${termsPattern})\\s*:?\\s*([^\\n\\r#]+?)(?=\\s*$|\\s*#|\\s*\\n)`,
    'i'
  );

  const match = message.match(authorNameRegex);
  return match?.[1]?.trim() ?? null;
}
