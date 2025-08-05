import { VRChat } from 'vrchat';
import Config from '../assets/config';
import KeyvFile from 'keyv-file';

export const vrchat = new VRChat({
  application: {
    name: 'VrcWorldTagger',
    version: '0.0.1',
    contact: 'vrcworldtagger@gmail.com'
  },
  authentication: {
    credentials: {
      username: Config.VRC_USERNAME,
      password: Config.VRC_PASSWORD,
      totpSecret: Config.VRC_TOTP_KEY
    }
  },
  keyv: new KeyvFile({ filename: './data.json' })
});
