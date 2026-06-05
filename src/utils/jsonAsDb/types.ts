/**
 * Database keys for storing various bot data
 */
export enum kvKeys {
  /** Channels being watched for VRC world links */
  WATCHED_CHANNELS = 'WATCHED_CHANNELS',
  /** Channels where reaction-based forwarding is enabled */
  WATCHED_REACTION_CHANNELS = 'WATCHED_REACTION_CHANNELS',
  /** Channel for forwarding player count updates */
  PLAYER_COUNT_FORWARDING_CHANNEL = 'PLAYER_COUNT_FORWARDING_CHANNEL',
  /** Channel for forwarding Android support messages */
  ANDROID_FORWARDING_CHANNEL = 'ANDROID_FORWARDING_CHANNEL',
  /** Channel for low capacity worlds **/
  LOW_CAPACITY_FORWARDING_CHANNEL = 'LOW_CAPACITY_FORWARDING_CHANNEL',
  /** Mapping of reaction emoji to forwarding channel IDs */
  REACTION_FORWARD_CHANNELS = 'REACTION_FORWARD_CHANNELS',
  /** Worlds that have been processed to avoid duplicates — @deprecated Replaced by SQLite world_records table in V2 */
  PROCESSED_WORLDS = 'PROCESSED_WORLDS',
  /** Worlds that have been processed to avoid duplicates, with original message ID — @deprecated Replaced by SQLite world_records table in V2 */
  PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID = 'PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID',
  /** Channel history crawling status and progress */
  CHANNEL_HISTORY_CRAWL_STATUS = 'CHANNEL_HISTORY_CRAWL_STATUS',
  /** Message IDs that have already been forwarded via reaction (one forward per message) */
  REACTION_FORWARDED_MESSAGE_IDS = 'REACTION_FORWARDED_MESSAGE_IDS',
  /** Message IDs that have already been force-refetched via recycle reaction (one refetch per message) */
  FORCE_REFETCHED_MESSAGE_IDS = 'FORCE_REFETCHED_MESSAGE_IDS',
  /** Emoji keys that delete the bot's own messages when reacted (in .watchReacts channels) */
  REACT_TO_DELETE_EMOJIS = 'REACT_TO_DELETE_EMOJIS',
  /** Discord user IDs that opted out of message and reaction processing */
  IGNORED_USERS = 'IGNORED_USERS'
}

/**
 * Types for channel history crawling
 */
export interface CrawlStatus {
  channelId: string;
  isRunning: boolean;
  startTime: string;
  lastUpdateTime: string;
  messagesProcessed: number;
  worldsDiscovered: number;
  lastMessageId?: string;
  error?: string;
}
