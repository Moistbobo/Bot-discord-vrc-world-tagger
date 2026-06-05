import Database from 'better-sqlite3';
import { runMigrations } from './schema';
import {
  WorldRepository,
  resetWorldRepository,
  type WorldRecord
} from './worldRepository';

function createTestRecord(overrides: Partial<WorldRecord> = {}): WorldRecord {
  return {
    worldId: 'wrld_test-1234-5678-90ab-cdefghijklmn',
    guildId: '111111111111111111',
    messageId: '222222222222222222',
    name: 'Test World',
    authorName: 'TestAuthor',
    capacity: 16,
    platforms: ['standalonewindows', 'android'],
    tags: ['horror', 'game'],
    imageUrl: 'https://example.com/image.png',
    sourceContent: 'A horror game world #horror #game',
    vrchatData: '{"id":"wrld_test"}',
    ...overrides
  };
}

describe('WorldRepository', () => {
  let db: Database.Database;
  let repo: WorldRepository;

  beforeEach(() => {
    resetWorldRepository();
    db = new Database(':memory:');
    runMigrations(db);
    repo = new WorldRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('upsert', () => {
    it('inserts a new world record', () => {
      const record = createTestRecord();
      repo.upsert(record);

      const found = repo.getByWorldAndGuild(record.worldId, record.guildId);
      expect(found).toBeDefined();
      expect(found!.worldId).toBe(record.worldId);
      expect(found!.name).toBe('Test World');
      expect(found!.tags).toEqual(['horror', 'game']);
      expect(found!.platforms).toEqual(['standalonewindows', 'android']);
      expect(found!.createdAt).toBeDefined();
    });

    it('updates an existing record without resetting created_at', () => {
      const record = createTestRecord();
      repo.upsert(record);

      const first = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      const originalCreatedAt = first.createdAt;
      const originalId = first.id;

      // Small delay to ensure updated_at changes
      const updated = createTestRecord({ name: 'Updated World' });
      repo.upsert(updated);

      const second = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      expect(second.id).toBe(originalId);
      expect(second.name).toBe('Updated World');
      expect(second.createdAt).toBe(originalCreatedAt);
      expect(second.updatedAt).toBeGreaterThanOrEqual(originalCreatedAt!);
    });

    it('allows the same world in different guilds', () => {
      const record1 = createTestRecord({ guildId: 'guild-a' });
      const record2 = createTestRecord({ guildId: 'guild-b' });

      repo.upsert(record1);
      repo.upsert(record2);

      const all = repo.getByWorldId(record1.worldId);
      expect(all).toHaveLength(2);
      expect(all.map((r) => r.guildId)).toContain('guild-a');
      expect(all.map((r) => r.guildId)).toContain('guild-b');
    });
  });

  describe('getByWorldId', () => {
    it('returns empty array when no records exist', () => {
      const result = repo.getByWorldId('wrld_nonexistent');
      expect(result).toEqual([]);
    });

    it('returns all guild instances ordered by created_at desc', () => {
      repo.upsert(createTestRecord({ guildId: 'guild-a', name: 'World A' }));
      repo.upsert(createTestRecord({ guildId: 'guild-b', name: 'World B' }));

      const result = repo.getByWorldId(createTestRecord().worldId);
      expect(result).toHaveLength(2);
      // Both should be in desc created_at order
      expect(result[0].createdAt!).toBeGreaterThanOrEqual(result[1].createdAt!);
    });
  });

  describe('getByWorldAndGuild', () => {
    it('returns undefined for missing record', () => {
      expect(repo.getByWorldAndGuild('missing', 'missing')).toBeUndefined();
    });

    it('returns the correct guild-scoped record', () => {
      repo.upsert(createTestRecord({ guildId: 'guild-a' }));
      repo.upsert(createTestRecord({ guildId: 'guild-b' }));

      const found = repo.getByWorldAndGuild(
        createTestRecord().worldId,
        'guild-a'
      );
      expect(found).toBeDefined();
      expect(found!.guildId).toBe('guild-a');
    });
  });

  describe('deleteByWorldAndGuild', () => {
    it('returns false when record does not exist', () => {
      expect(repo.deleteByWorldAndGuild('missing', 'missing')).toBe(false);
    });

    it('deletes the correct record and leaves others', () => {
      repo.upsert(createTestRecord({ guildId: 'guild-a' }));
      repo.upsert(createTestRecord({ guildId: 'guild-b' }));

      expect(
        repo.deleteByWorldAndGuild(createTestRecord().worldId, 'guild-a')
      ).toBe(true);

      const remaining = repo.getByWorldId(createTestRecord().worldId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].guildId).toBe('guild-b');
    });
  });

  describe('getAllPaginated', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        repo.upsert(
          createTestRecord({
            worldId: `wrld_${i}`,
            guildId: 'guild-1',
            tags: i % 2 === 0 ? ['horror'] : ['game'],
            name: `World ${i}`
          })
        );
      }
    });

    it('returns paginated results', () => {
      const { rows, total } = repo.getAllPaginated(2, 0);
      expect(total).toBe(5);
      expect(rows).toHaveLength(2);
    });

    it('respects offset', () => {
      const { rows: first } = repo.getAllPaginated(2, 0);
      const { rows: second } = repo.getAllPaginated(2, 2);
      expect(first[0].worldId).not.toBe(second[0].worldId);
    });

    it('filters by single tag', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, { tags: ['horror'] });
      expect(total).toBe(3); // worlds 0, 2, 4
      expect(rows.every((r) => r.tags.includes('horror'))).toBe(true);
    });

    it('filters by multiple tags with AND logic', () => {
      // Insert a world with both tags
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_both',
          guildId: 'guild-1',
          tags: ['horror', 'game']
        })
      );

      const { rows, total } = repo.getAllPaginated(10, 0, {
        tags: ['horror', 'game']
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_both');
    });

    it('filters by guildId', () => {
      repo.upsert(
        createTestRecord({ worldId: 'wrld_other', guildId: 'guild-2' })
      );

      const { total } = repo.getAllPaginated(10, 0, { guildId: 'guild-2' });
      expect(total).toBe(1);
    });

    it('combines guildId and tag filters', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_other',
          guildId: 'guild-2',
          tags: ['horror']
        })
      );

      const { rows, total } = repo.getAllPaginated(10, 0, {
        guildId: 'guild-2',
        tags: ['horror']
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_other');
    });
  });

  describe('getUniqueTags', () => {
    it('returns empty array when no records', () => {
      expect(repo.getUniqueTags()).toEqual([]);
    });

    it('returns tags with counts sorted desc', () => {
      repo.upsert(createTestRecord({ tags: ['horror'] }));
      repo.upsert(
        createTestRecord({ worldId: 'wrld_2', tags: ['horror', 'game'] })
      );
      repo.upsert(createTestRecord({ worldId: 'wrld_3', tags: ['game'] }));

      const tags = repo.getUniqueTags();
      expect(tags).toEqual([
        { tag: 'horror', count: 2 },
        { tag: 'game', count: 2 }
      ]);
    });
  });

  describe('count', () => {
    it('returns 0 for empty database', () => {
      expect(repo.count()).toBe(0);
    });

    it('returns total record count', () => {
      repo.upsert(createTestRecord());
      repo.upsert(createTestRecord({ worldId: 'wrld_2' }));
      expect(repo.count()).toBe(2);
    });
  });

  describe('getLastProcessed', () => {
    it('returns undefined when empty', () => {
      expect(repo.getLastProcessed()).toBeUndefined();
    });

    it('returns the most recently created record', () => {
      repo.upsert(createTestRecord({ worldId: 'wrld_first', name: 'First' }));
      repo.upsert(createTestRecord({ worldId: 'wrld_second', name: 'Second' }));

      const last = repo.getLastProcessed();
      expect(last).toBeDefined();
      expect(last!.name).toBe('Second');
    });
  });
});
