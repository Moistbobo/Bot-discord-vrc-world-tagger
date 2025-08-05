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
  PROCESSED_WORLDS = 'PROCESSED_WORLDS'
}

/**
 * Type for database operation results
 */
export type DbOperationResult = {
  success: boolean;
  error?: string;
};
