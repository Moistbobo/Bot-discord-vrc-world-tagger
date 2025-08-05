const VRCHAT_WORLD_LINK_REGEX = /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}/;
const VRCHAT_WORLD_ID_REGEX = /wrld_[a-f0-9-]{36}/;
const VRCHAT_LINK_REMOVE_REGEX = /https:\/\/vrchat\.com\/home\/world\/wrld_[a-f0-9-]{36}(\/\S*)?/;
const GENERIC_LINK_REGEX = /https?:\/\/\S+/;
const TWITTER_LINK_REGEX = /(?:https?:\/\/)?(?:x\.com|fixupx\.com|vxtwitter\.com)\/([^?\s]+)/;
const FILE_ID_REGEX = /file_([a-f0-9-]+)/;

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
