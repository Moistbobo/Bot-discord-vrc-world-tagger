/**
 * Database keys for storing various bot data
 */
export enum kvKeys {
  /** Channels being watched for VRC world links */
  WATCHED_CHANNELS = 'WATCHED_CHANNELS',
  /** Channel for forwarding player count updates */
  PLAYER_COUNT_FORWARDING_CHANNEL = 'PLAYER_COUNT_FORWARDING_CHANNEL',
  /** Channel for forwarding Android support messages */
  ANDROID_FORWARDING_CHANNEL = 'ANDROID_FORWARDING_CHANNEL',
  /** Worlds that have been processed to avoid duplicates */
  PROCESSED_WORLDS = 'PROCESSED_WORLDS',
  /** Worlds that have been processed to avoid duplicates, with original message ID */
  PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID = 'PROCESSED_WORLDS_WITH_ORIGINAL_MESSAGE_ID',
  /** Channel history crawling status and progress */
  CHANNEL_HISTORY_CRAWL_STATUS = 'CHANNEL_HISTORY_CRAWL_STATUS'
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
