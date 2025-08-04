import KeyvFile from 'keyv-file';

class Kv extends KeyvFile {
  constructor() {
    super({
      filename: './db.json'
    });
  }
}

export enum kvKeys {
  WATCHED_CHANNELS = 'WATCHED_CHANNELS'
}

export const kv = new Kv();
