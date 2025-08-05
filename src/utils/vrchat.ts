import { VRChat } from 'vrchat';
import Config from '../assets/config';
import KeyvFile from 'keyv-file';
import packageJson from '../../package.json';

export const vrchat = new VRChat({
  application: {
    name: 'VrcWorldTagger',
    version: packageJson.version,
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
