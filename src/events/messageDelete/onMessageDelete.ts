import { Message } from 'discord.js';
import logger from '../../utils/logger';
import { api, isApiError } from '../../utils/apiClient';
import {
  isHighPriorityChannel,
  takeHighPriorityForward
} from '../../utils/highPriorityChannel';

export const onMessageDelete = async (message: Message): Promise<void> => {
  if (!(await isHighPriorityChannel(message.channelId))) return;

  const record = await takeHighPriorityForward(message.id);
  if (!record) {
    logger.debug(
      `No high priority forward record for deleted message ${message.id}`
    );
    return;
  }

  try {
    await api.removeHighPriority(record.worldId, record.guildId);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      logger.warn(
        `World ${record.worldId} not found in guild ${record.guildId} (high priority remove noop)`
      );
    } else {
      logger.error(
        `Failed to remove high priority for world ${record.worldId} in guild ${record.guildId}:`,
        error
      );
    }
  }
};
