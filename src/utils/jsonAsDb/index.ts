import KeyvFile from 'keyv-file';

class Kv extends KeyvFile {
  constructor() {
    super({
      filename: './db.json'
    });
  }
}

export const kv = new Kv();
