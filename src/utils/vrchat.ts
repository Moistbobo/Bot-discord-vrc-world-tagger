import { VRChat } from 'vrchat';
import Config from '../config';
import KeyvFile from 'keyv-file';

export const vrchat = new VRChat({
  /**
   * When using the VRChat API, you must provide an application name, version, and contact information.
   * This is used to identify your application to VRChat, and to provide support if needed.
   */
  application: {
    name: 'VrcWorldTagger',
    version: '0.0.1',
    /**
     * An email, or a URL to a support page.
     */
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


