import dotenv from 'dotenv';

dotenv.config();

const Config = {
  TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: process.env.ADMIN_ID ? process.env.ADMIN_ID.split(',') : [],
  VRC_USERNAME: process.env.VRC_USERNAME,
  VRC_PASSWORD: process.env.VRC_PASSWORD,
  VRC_TOTP_KEY: process.env.VRC_TOTP_KEY,
  DEV_MODE: process.env.DEV,
  WORLD_NAME_MATCHERS: process.env.WORLD_NAME_MATCHERS.split(','),
  AUTHOR_NAME_MATCHERS: process.env.AUTHOR_NAME_MATCHERS.split(',')
};

export default Config;
