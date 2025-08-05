import KeyvFile from 'keyv-file';
import path from 'path';

interface KvConfig {
  filename?: string;
}

class Kv extends KeyvFile {
  constructor(config: KvConfig = {}) {
    const defaultFilename = path.join(process.cwd(), 'db.json');
    super({
      filename: config.filename || defaultFilename
    });
  }

  /**
   * Safely get a value with error handling
   */
  async safeGet<T>(key: string): Promise<T | undefined> {
    try {
      const result = await this.get(key);
      return result as T;
    } catch (error) {
      console.error(`Error getting key "${key}":`, error);
      return undefined;
    }
  }

  /**
   * Safely set a value with error handling
   */
  async safeSet<T>(key: string, value: T): Promise<boolean> {
    try {
      await this.set(key, value);
      return true;
    } catch (error) {
      console.error(`Error setting key "${key}":`, error);
      return false;
    }
  }

  /**
   * Safely delete a value with error handling
   */
  async safeDelete(key: string): Promise<boolean> {
    try {
      return await this.delete(key);
    } catch (error) {
      console.error(`Error deleting key "${key}":`, error);
      return false;
    }
  }
}

export const kv = new Kv();
