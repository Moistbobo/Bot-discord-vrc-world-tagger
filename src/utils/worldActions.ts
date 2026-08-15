import { api, isApiError } from './apiClient';
import logger from './logger';

/**
 * Deletes a world record via the API for the given guild.
 * This is the canonical way to remove a world from the database.
 * Exported for reuse by both text-based `.remove` and the 🔁 reaction shortcut.
 *
 * @param worldId  The VRChat world ID (e.g. wrld_…)
 * @param guildId  The Discord guild ID
 * @returns        true if a row existed and was deleted, false otherwise
 */
export async function deleteWorldForGuild(
  worldId: string,
  guildId: string
): Promise<boolean> {
  try {
    await api.deleteWorld(worldId, guildId);
    logger.info(`Deleted world ${worldId} in guild ${guildId}`);
    return true;
  } catch (err) {
    if (isApiError(err) && err.status === 404) {
      logger.warn(
        `World ${worldId} not found in guild ${guildId} (delete noop)`
      );
    } else {
      logger.error(
        `Failed to delete world ${worldId} for guild ${guildId}: ${err}`
      );
    }
    return false;
  }
}
