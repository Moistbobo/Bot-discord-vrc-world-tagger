import dotenv from 'dotenv';

dotenv.config();

const Config = {
  TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: process.env.ADMIN_ID ? process.env.ADMIN_ID.split(',') : [],
  VRC_USERNAME: process.env.VRC_USERNAME,
  VRC_PASSWORD: process.env.VRC_PASSWORD,
  VRC_TOTP_KEY: process.env.VRC_TOTP_KEY,
  DEV_MODE: process.env?.DEV === 'true',
  WORLD_NAME_MATCHERS: process.env?.WORLD_NAME_MATCHERS
    ? process.env.WORLD_NAME_MATCHERS.split(',')
    : [],
  AUTHOR_NAME_MATCHERS: process.env?.AUTHOR_NAME_MATCHERS
    ? process.env.AUTHOR_NAME_MATCHERS.split(',')
    : [],
  EXPORT_RATE_LIMIT: Number(process.env.EXPORT_RATE_LIMIT) || 1500,
  FORWARD_PLAYER_COUNT_THRESHOLD:
    Number(process.env.FORWARD_PLAYER_COUNT_THRESHOLD) || 40,
  LOW_CAPACITY_THRESHOLD: Number(process.env.LOW_CAPACITY_THRESHOLD) || 20,
  DATABASE_PATH: process.env.DATABASE_PATH || './worlds.db',
  API_PORT: Number(process.env.API_PORT) || 3000,
  API_HOST: process.env.API_HOST || '0.0.0.0',
  API_TOKEN: process.env.API_TOKEN
    ? process.env.API_TOKEN.split(',')
    : process.env.EXPORT_API_TOKEN
      ? [process.env.EXPORT_API_TOKEN]
      : [],
  API_ALLOWED_ORIGINS: process.env.API_ALLOWED_ORIGINS
    ? process.env.API_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : [],
  API_ALLOWED_IPS: process.env.API_ALLOWED_IPS
    ? process.env.API_ALLOWED_IPS.split(',').map((ip) => ip.trim())
    : [],
  DISABLE_API_RESTRICTIONS:
    process.env.DISABLE_API_RESTRICTIONS === 'true' ||
    process.env.DEV === 'true'
};

export default Config;
