import dotenv from 'dotenv';

dotenv.config();

const Config = {
  TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: process.env.ADMIN_ID ? process.env.ADMIN_ID.split(',') : [],
  DEV_MODE: process.env?.DEV === 'true',
  EXPORT_RATE_LIMIT: Number(process.env.EXPORT_RATE_LIMIT) || 1500,
  FORWARD_PLAYER_COUNT_THRESHOLD:
    Number(process.env.FORWARD_PLAYER_COUNT_THRESHOLD) || 40,
  LOW_CAPACITY_THRESHOLD: Number(process.env.LOW_CAPACITY_THRESHOLD) || 20,
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  API_TOKEN: process.env.API_TOKEN
    ? process.env.API_TOKEN.split(',')[0]
    : process.env.EXPORT_API_TOKEN
      ? process.env.EXPORT_API_TOKEN
      : ''
};

export default Config;
