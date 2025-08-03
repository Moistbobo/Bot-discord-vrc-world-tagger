import dotenv from 'dotenv';

dotenv.config();

const Config = {
  TOKEN: process.env.BOT_TOKEN,
  VRC_USERNAME: process.env.VRC_USERNAME,
  VRC_PASSWORD: process.env.VRC_PASSWORD,
  VRC_TOTP_KEY: process.env.VRC_TOTP_KEY
};

export default Config;
