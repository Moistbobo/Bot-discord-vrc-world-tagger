import { extractAllWorldIds } from '../../../../utils/regex';
import { api } from '../../../../utils/apiClient';

const TWITTER_LINK_REGEX = /twitter\.com|x\.com|vxtwitter\.com|fixupx\.com/i;

/**
 * Extracts all world IDs from message content, including resolving Twitter links.
 * Returns world IDs in order of first appearance, deduplicated.
 *
 * Direct `wrld_` links are extracted locally (identical to the API pipeline's
 * direct-ID step) so plain world links do not depend on API availability.
 * Twitter/X resolution (vxtwitter fetch + VRChat world name search) is
 * delegated to the sos-world-tagger-api service.
 */
export const extractAllWorldIdsFromMessage = async (
  content: string
): Promise<{ worldId: string; sourceContent: string }[]> => {
  if (!TWITTER_LINK_REGEX.test(content)) {
    return extractAllWorldIds(content).map((worldId) => ({
      worldId,
      sourceContent: content
    }));
  }
  return api.extractWorlds(content);
};

/**
 * Extracts world ID from message content or Twitter links (first match only)
 */
export const extractWorldIdFromMessage = async (
  content: string
): Promise<string | null> => {
  const all = await extractAllWorldIdsFromMessage(content);
  return all[0]?.worldId ?? null;
};
