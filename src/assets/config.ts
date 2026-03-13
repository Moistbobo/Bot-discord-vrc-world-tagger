import dotenv from 'dotenv';

dotenv.config();

const Config = {
  TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: process.env.ADMIN_ID ? process.env.ADMIN_ID.split(',') : [],
  VRC_USERNAME: process.env.VRC_USERNAME,
  VRC_PASSWORD: process.env.VRC_PASSWORD,
  VRC_TOTP_KEY: process.env.VRC_TOTP_KEY,
  DEV_MODE: process.env?.DEV === 'true',
  WORLD_NAME_MATCHERS: process.env.WORLD_NAME_MATCHERS.split(','),
  AUTHOR_NAME_MATCHERS: process.env.AUTHOR_NAME_MATCHERS.split(','),
  EXPORT_RATE_LIMIT: Number(process.env.EXPORT_RATE_LIMIT) || 1500,
  FORWARD_PLAYER_COUNT_THRESHOLD:
    Number(process.env.FORWARD_PLAYER_COUNT_THRESHOLD) || 40,
  LOW_CAPACITY_THRESHOLD: Number(process.env.LOW_CAPACITY_THRESHOLD) || 20
};

export default Config;
