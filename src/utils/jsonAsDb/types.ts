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
  CHANNEL_HISTORY_CRAWL_STATUS = 'CHANNEL_HISTORY_CRAWL_STATUS',
  /** Historical worlds discovered through crawling */
  HISTORICAL_WORLDS = 'HISTORICAL_WORLDS',
  /** Crawl progress tracking */
  CRAWL_PROGRESS = 'CRAWL_PROGRESS'
}

/**
 * Type for database operation results
 */
export type DbOperationResult = {
  success: boolean;
  error?: string;
};

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

export interface HistoricalWorld {
  worldId: string;
  firstSeen: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
  messageCount: number;
  channels: string[]; // Channel IDs where found
  sources: {
    channelId: string;
    messageId: string;
    timestamp: string;
    content: string;
  }[];
}

export interface CrawlProgress {
  channelId: string;
  currentBatch: number;
  totalBatches: number;
  messagesInCurrentBatch: number;
  estimatedRemaining: number; // in seconds
}
