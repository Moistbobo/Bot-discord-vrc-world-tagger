import { getWorldRepository } from './database/worldRepository';
import logger from './logger';

/**
 * Deletes a world record from the SQLite repository for the given guild.
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
    const success = getWorldRepository().deleteByWorldAndGuild(
      worldId,
      guildId
    );
    if (success) {
      logger.info(
        `Deleted world ${worldId} from repository in guild ${guildId}`
      );
    } else {
      logger.warn(
        `World ${worldId} not found in repository for guild ${guildId} (delete noop)`
      );
    }
    return success;
  } catch (err) {
    logger.error(
      `Failed to delete world ${worldId} for guild ${guildId}:
      ${err}`
    );
    return false;
  }
}
