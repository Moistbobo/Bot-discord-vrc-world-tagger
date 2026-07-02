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
    internalAddDate: 1_700_000_000,
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
      expect(found!.internalAddDate).toBe(1_700_000_000);
    });

    it('updates an existing record without resetting created_at or internal_add_date', () => {
      const record = createTestRecord();
      repo.upsert(record);

      const first = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      const originalCreatedAt = first.createdAt;
      const originalInternalAddDate = first.internalAddDate;
      const originalId = first.id;

      // Small delay to ensure updated_at changes
      const updated = createTestRecord({
        name: 'Updated World',
        internalAddDate: 1_800_000_000
      });
      repo.upsert(updated);

      const second = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      expect(second.id).toBe(originalId);
      expect(second.name).toBe('Updated World');
      expect(second.createdAt).toBe(originalCreatedAt);
      expect(second.internalAddDate).toBe(originalInternalAddDate);
      expect(second.messageId).toBe(record.messageId); // original message_id preserved
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

    it('fills internal_add_date on conflict when the existing value is null', () => {
      // Simulate a legacy row that has no internal_add_date
      db.prepare(
        `INSERT INTO world_records
          (world_id, guild_id, message_id, name, author_name, capacity,
           platforms, tags, image_url, source_content, vrchat_data, created_at, updated_at, internal_add_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        createTestRecord().worldId,
        createTestRecord().guildId,
        createTestRecord().messageId,
        createTestRecord().name,
        createTestRecord().authorName,
        createTestRecord().capacity,
        JSON.stringify(createTestRecord().platforms),
        JSON.stringify(createTestRecord().tags),
        createTestRecord().imageUrl,
        createTestRecord().sourceContent,
        createTestRecord().vrchatData,
        1_600_000_000,
        1_600_000_000,
        null
      );

      repo.upsert(createTestRecord({ internalAddDate: 1_800_000_000 }));
      let found = repo.getByWorldAndGuild(
        createTestRecord().worldId,
        createTestRecord().guildId
      )!;
      expect(found.internalAddDate).toBe(1_800_000_000);

      // Re-upserting with a different date must not overwrite
      repo.upsert(createTestRecord({ internalAddDate: 1_900_000_000 }));
      found = repo.getByWorldAndGuild(
        createTestRecord().worldId,
        createTestRecord().guildId
      )!;
      expect(found.internalAddDate).toBe(1_800_000_000);
    });

    it('uses provided internal_add_date on insert', () => {
      repo.upsert(createTestRecord({ internalAddDate: 1_680_000_000 }));
      const found = repo.getByWorldAndGuild(
        createTestRecord().worldId,
        createTestRecord().guildId
      )!;
      expect(found.internalAddDate).toBe(1_680_000_000);
    });
  });

  describe('backfillInternalAddDate', () => {
    it('returns false when record does not exist', () => {
      expect(
        repo.backfillInternalAddDate('missing', 'missing', 1_700_000_000)
      ).toBe(false);
    });

    it('sets internal_add_date when null and preserves existing value', () => {
      repo.upsert(createTestRecord({ internalAddDate: undefined }));
      db.prepare(
        'UPDATE world_records SET internal_add_date = NULL WHERE world_id = ? AND guild_id = ?'
      ).run(createTestRecord().worldId, createTestRecord().guildId);

      expect(
        repo.backfillInternalAddDate(
          createTestRecord().worldId,
          createTestRecord().guildId,
          1_650_000_000
        )
      ).toBe(true);

      const found = repo.getByWorldAndGuild(
        createTestRecord().worldId,
        createTestRecord().guildId
      )!;
      expect(found.internalAddDate).toBe(1_650_000_000);

      expect(
        repo.backfillInternalAddDate(
          createTestRecord().worldId,
          createTestRecord().guildId,
          1_800_000_000
        )
      ).toBe(false);
      expect(found.internalAddDate).toBe(1_650_000_000);
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

    it('archives internal_add_date into deleted_world_records', () => {
      repo.upsert(
        createTestRecord({ guildId: 'guild-a', internalAddDate: 1_700_000_000 })
      );

      repo.deleteByWorldAndGuild(createTestRecord().worldId, 'guild-a');

      const archived = db
        .prepare(
          'SELECT internal_add_date FROM deleted_world_records WHERE world_id = ? AND guild_id = ?'
        )
        .get(createTestRecord().worldId, 'guild-a') as {
        internal_add_date: number;
      };
      expect(archived.internal_add_date).toBe(1_700_000_000);
    });
  });

  describe('updateTags', () => {
    it('returns false when record does not exist', () => {
      expect(repo.updateTags('missing', 'missing', ['tag'], 'content')).toBe(
        false
      );
    });

    it('returns false when tags and sourceContent are unchanged', () => {
      const record = createTestRecord({
        tags: ['horror', 'game'],
        sourceContent: 'original'
      });
      repo.upsert(record);

      const before = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      const result = repo.updateTags(
        record.worldId,
        record.guildId,
        ['horror', 'game'],
        'original'
      );
      const after = repo.getByWorldAndGuild(record.worldId, record.guildId)!;

      expect(result).toBe(false);
      expect(after.updatedAt).toBe(before.updatedAt);
    });

    it('returns true when tags change', () => {
      const record = createTestRecord({ tags: ['horror'] });
      repo.upsert(record);

      const result = repo.updateTags(
        record.worldId,
        record.guildId,
        ['horror', 'puzzle'],
        record.sourceContent
      );
      expect(result).toBe(true);

      const updated = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      expect(updated.tags).toEqual(['horror', 'puzzle']);
    });

    it('returns true when sourceContent changes', () => {
      const record = createTestRecord({ sourceContent: 'old content' });
      repo.upsert(record);

      const result = repo.updateTags(
        record.worldId,
        record.guildId,
        record.tags,
        'new content'
      );
      expect(result).toBe(true);

      const updated = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      expect(updated.sourceContent).toBe('new content');
    });
  });

  describe('updateQuality', () => {
    it('returns false when record does not exist', () => {
      expect(repo.updateQuality('missing', 'missing', 'good')).toBe(false);
    });

    it('returns false when quality is unchanged', () => {
      const record = createTestRecord();
      repo.upsert(record);
      repo.updateQuality(record.worldId, record.guildId, 'good');

      const before = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      const result = repo.updateQuality(record.worldId, record.guildId, 'good');
      const after = repo.getByWorldAndGuild(record.worldId, record.guildId)!;

      expect(result).toBe(false);
      expect(after.quality).toBe('good');
      expect(after.updatedAt).toBe(before.updatedAt);
    });

    it('returns true when quality changes from null', () => {
      const record = createTestRecord();
      repo.upsert(record);

      const result = repo.updateQuality(record.worldId, record.guildId, 'bad');
      expect(result).toBe(true);

      const updated = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      expect(updated.quality).toBe('bad');
    });

    it('returns true when quality changes from one value to another', () => {
      const record = createTestRecord();
      repo.upsert(record);
      repo.updateQuality(record.worldId, record.guildId, 'good');

      const result = repo.updateQuality(record.worldId, record.guildId, 'bad');
      expect(result).toBe(true);

      const updated = repo.getByWorldAndGuild(record.worldId, record.guildId)!;
      expect(updated.quality).toBe('bad');
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

    it('filters by search term across name, author, source content, world id and tags', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_match_name',
          guildId: 'guild-1',
          name: 'Ghost Forest',
          authorName: 'SomeAuthor',
          tags: ['horror']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_match_author',
          guildId: 'guild-1',
          name: 'Mystery Mansion',
          authorName: 'GhostlyBuilder',
          tags: ['game']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_match_tag',
          guildId: 'guild-1',
          name: 'Plain World',
          authorName: 'PlainAuthor',
          tags: ['ghost']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_match_source',
          guildId: 'guild-1',
          name: 'Source World',
          authorName: 'SourceAuthor',
          tags: ['puzzle'],
          sourceContent: 'ghostly atmosphere'
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_ghost_id',
          guildId: 'guild-1',
          name: 'Id World',
          authorName: 'IdAuthor',
          tags: ['rpg'],
          sourceContent: null
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_no_match',
          guildId: 'guild-1',
          name: 'Sunny Beach',
          authorName: 'SunDev',
          tags: ['relax']
        })
      );

      const { rows, total } = repo.getAllPaginated(20, 0, { search: 'ghost' });
      expect(total).toBe(5);
      expect(rows.map((r) => r.worldId).sort()).toEqual([
        'wrld_ghost_id',
        'wrld_match_author',
        'wrld_match_name',
        'wrld_match_source',
        'wrld_match_tag'
      ]);
    });

    it('requires all search terms to match (AND logic)', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_both_terms',
          guildId: 'guild-1',
          name: 'Crystal Cave',
          authorName: 'CaveAuthor',
          tags: ['crystal']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_one_term',
          guildId: 'guild-1',
          name: 'Crystal Lake',
          authorName: 'LakeAuthor',
          tags: ['water']
        })
      );

      const { rows, total } = repo.getAllPaginated(20, 0, {
        search: 'crystal cave'
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_both_terms');
    });

    it('ignores empty or whitespace-only search', () => {
      const { rows: empty } = repo.getAllPaginated(10, 0, { search: '' });
      const { rows: whitespace } = repo.getAllPaginated(10, 0, {
        search: '   '
      });
      const { rows: noSearch } = repo.getAllPaginated(10, 0);

      expect(empty).toHaveLength(5);
      expect(whitespace).toHaveLength(5);
      expect(noSearch).toHaveLength(5);
    });

    it('combines search with tag and quality filters', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_good_match',
          guildId: 'guild-1',
          name: 'Ghost Ship',
          tags: ['horror']
        })
      );
      repo.updateQuality('wrld_good_match', 'guild-1', 'good');
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_bad_match',
          guildId: 'guild-1',
          name: 'Ghost Town',
          tags: ['horror']
        })
      );
      repo.updateQuality('wrld_bad_match', 'guild-1', 'bad');
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_good_no_match',
          guildId: 'guild-1',
          name: 'Sunny Ship',
          tags: ['horror']
        })
      );
      repo.updateQuality('wrld_good_no_match', 'guild-1', 'good');

      const { rows, total } = repo.getAllPaginated(20, 0, {
        search: 'ghost',
        tags: ['horror'],
        quality: ['good']
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_good_match');
    });

    it('is case-insensitive for ASCII search terms', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_case',
          guildId: 'guild-1',
          name: 'UPPERCASE WORLD'
        })
      );

      const { rows, total } = repo.getAllPaginated(20, 0, {
        search: 'uppercase'
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_case');
    });

    it('respects pagination when searching', () => {
      for (let i = 0; i < 5; i++) {
        repo.upsert(
          createTestRecord({
            worldId: `wrld_paginated_${i}`,
            guildId: 'guild-1',
            name: `Searchable World ${i}`
          })
        );
      }

      const { rows: first, total } = repo.getAllPaginated(2, 0, {
        search: 'Searchable'
      });
      const { rows: second } = repo.getAllPaginated(2, 2, {
        search: 'Searchable'
      });

      expect(total).toBe(5);
      expect(first).toHaveLength(2);
      expect(second).toHaveLength(2);
      expect(first[0].worldId).not.toBe(second[0].worldId);
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

    it('filters by worldIds', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_alpha',
          guildId: 'guild-1',
          name: 'Alpha World'
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_beta',
          guildId: 'guild-1',
          name: 'Beta World'
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_gamma',
          guildId: 'guild-1',
          name: 'Gamma World'
        })
      );

      const { rows, total } = repo.getAllPaginated(10, 0, {
        worldIds: ['wrld_alpha', 'wrld_gamma', 'wrld_missing']
      });
      expect(total).toBe(2);
      expect(rows.map((r) => r.worldId).sort()).toEqual([
        'wrld_alpha',
        'wrld_gamma'
      ]);
    });

    it('returns no results for empty worldIds list', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, { worldIds: [] });
      expect(total).toBe(5);
      expect(rows).toHaveLength(5);
    });

    it('combines worldIds filter with other filters', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_alpha',
          guildId: 'guild-1',
          tags: ['horror']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_beta',
          guildId: 'guild-1',
          tags: ['game']
        })
      );

      const { rows, total } = repo.getAllPaginated(10, 0, {
        worldIds: ['wrld_alpha', 'wrld_beta'],
        tags: ['horror']
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_alpha');
    });
  });

  describe('capacity filtering', () => {
    beforeEach(() => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_small',
          guildId: 'guild-1',
          capacity: 8
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_medium',
          guildId: 'guild-1',
          capacity: 32
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_large',
          guildId: 'guild-1',
          capacity: 80
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_unknown',
          guildId: 'guild-1',
          capacity: null
        })
      );
    });

    it('filters by minCapacity only', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, {
        minCapacity: 20
      });
      expect(total).toBe(2);
      expect(rows.map((r) => r.worldId).sort()).toEqual([
        'wrld_large',
        'wrld_medium'
      ]);
    });

    it('filters by maxCapacity only', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, {
        maxCapacity: 20
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_small');
    });

    it('filters by capacity range', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, {
        minCapacity: 10,
        maxCapacity: 40
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_medium');
    });

    it('excludes records with null capacity when capacity filter is active', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, {
        maxCapacity: 80
      });
      expect(total).toBe(3);
      expect(rows.map((r) => r.worldId).sort()).toEqual([
        'wrld_large',
        'wrld_medium',
        'wrld_small'
      ]);
    });

    it('does not apply a capacity filter when neither param is provided', () => {
      const { total } = repo.getAllPaginated(10, 0);
      expect(total).toBe(4);
    });

    it('combines capacity filter with tag and quality filters', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_match',
          guildId: 'guild-1',
          capacity: 32,
          tags: ['horror']
        })
      );
      repo.updateQuality('wrld_match', 'guild-1', 'good');
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_wrong_quality',
          guildId: 'guild-1',
          capacity: 32,
          tags: ['horror']
        })
      );
      repo.updateQuality('wrld_wrong_quality', 'guild-1', 'bad');
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_wrong_capacity',
          guildId: 'guild-1',
          capacity: 4,
          tags: ['horror']
        })
      );
      repo.updateQuality('wrld_wrong_capacity', 'guild-1', 'good');

      const { rows, total } = repo.getAllPaginated(10, 0, {
        minCapacity: 10,
        maxCapacity: 40,
        tags: ['horror'],
        quality: ['good']
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_match');
    });
  });

  describe('platform filtering', () => {
    beforeEach(() => {
      db.prepare('DELETE FROM world_records').run();

      repo.upsert(
        createTestRecord({
          worldId: 'wrld_pc_only',
          guildId: 'guild-1',
          platforms: ['standalonewindows']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_pc_and_android',
          guildId: 'guild-1',
          platforms: ['standalonewindows', 'android']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_all_three',
          guildId: 'guild-1',
          platforms: ['standalonewindows', 'android', 'ios']
        })
      );
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_ios_only',
          guildId: 'guild-1',
          platforms: ['ios']
        })
      );
    });

    it('filters by a single platform', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, {
        platforms: ['standalonewindows']
      });
      expect(total).toBe(3);
      expect(rows.map((r) => r.worldId).sort()).toEqual([
        'wrld_all_three',
        'wrld_pc_and_android',
        'wrld_pc_only'
      ]);
    });

    it('filters by multiple platforms with AND logic', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, {
        platforms: ['standalonewindows', 'android']
      });
      expect(total).toBe(2);
      expect(rows.map((r) => r.worldId).sort()).toEqual([
        'wrld_all_three',
        'wrld_pc_and_android'
      ]);
    });

    it('returns no results when platform does not match', () => {
      const { rows, total } = repo.getAllPaginated(10, 0, {
        platforms: ['unknown_platform']
      });
      expect(total).toBe(0);
      expect(rows).toEqual([]);
    });

    it('combines platform filter with other filters', () => {
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_match',
          guildId: 'guild-1',
          platforms: ['standalonewindows', 'android'],
          tags: ['horror'],
          capacity: 32
        })
      );
      repo.updateQuality('wrld_match', 'guild-1', 'good');
      repo.upsert(
        createTestRecord({
          worldId: 'wrld_wrong_platform',
          guildId: 'guild-1',
          platforms: ['standalonewindows'],
          tags: ['horror'],
          capacity: 32
        })
      );
      repo.updateQuality('wrld_wrong_platform', 'guild-1', 'good');

      const { rows, total } = repo.getAllPaginated(10, 0, {
        platforms: ['android'],
        tags: ['horror'],
        quality: ['good'],
        minCapacity: 10,
        maxCapacity: 40
      });
      expect(total).toBe(1);
      expect(rows[0].worldId).toBe('wrld_match');
    });
  });

  describe('getFilterCounts', () => {
    beforeEach(() => {
      db.prepare('DELETE FROM world_records').run();

      repo.upsert(
        createTestRecord({
          worldId: 'wrld_good_pc',
          guildId: 'guild-1',
          platforms: ['standalonewindows'],
          tags: ['horror'],
          capacity: 32
        })
      );
      repo.updateQuality('wrld_good_pc', 'guild-1', 'good');

      repo.upsert(
        createTestRecord({
          worldId: 'wrld_bad_android',
          guildId: 'guild-1',
          platforms: ['android'],
          tags: ['horror'],
          capacity: 16
        })
      );
      repo.updateQuality('wrld_bad_android', 'guild-1', 'bad');

      repo.upsert(
        createTestRecord({
          worldId: 'wrld_good_ios',
          guildId: 'guild-1',
          platforms: ['ios'],
          tags: ['game'],
          capacity: 8
        })
      );
      repo.updateQuality('wrld_good_ios', 'guild-1', 'good');

      repo.upsert(
        createTestRecord({
          worldId: 'wrld_unrated',
          guildId: 'guild-1',
          platforms: ['standalonewindows', 'android'],
          tags: ['horror'],
          capacity: 24
        })
      );
    });

    it('returns quality and platform counts for all records', () => {
      const result = repo.getFilterCounts();

      expect(result.qualityCounts).toEqual([
        { quality: 'good', count: 2 },
        { quality: 'bad', count: 1 }
      ]);
      expect(result.platformCounts).toEqual([
        { platform: 'android', count: 2 },
        { platform: 'standalonewindows', count: 2 },
        { platform: 'ios', count: 1 }
      ]);
    });

    it('returns zero quality counts when no records match', () => {
      const result = repo.getFilterCounts({ tags: ['nonexistent'] });

      expect(result.qualityCounts).toEqual([
        { quality: 'good', count: 0 },
        { quality: 'bad', count: 0 }
      ]);
      expect(result.platformCounts).toEqual([]);
    });

    it('ignores the selected quality filter when counting qualities', () => {
      const result = repo.getFilterCounts({ quality: ['good'] });

      expect(result.qualityCounts).toEqual([
        { quality: 'good', count: 2 },
        { quality: 'bad', count: 1 }
      ]);
    });

    it('ignores the selected platform filter when counting platforms', () => {
      const result = repo.getFilterCounts({ platforms: ['standalonewindows'] });

      expect(result.platformCounts).toEqual([
        { platform: 'android', count: 2 },
        { platform: 'standalonewindows', count: 2 },
        { platform: 'ios', count: 1 }
      ]);
    });

    it('applies tag filters to both quality and platform counts', () => {
      const result = repo.getFilterCounts({ tags: ['horror'] });

      expect(result.qualityCounts).toEqual([
        { quality: 'good', count: 1 },
        { quality: 'bad', count: 1 }
      ]);
      expect(result.platformCounts).toEqual([
        { platform: 'android', count: 2 },
        { platform: 'standalonewindows', count: 2 }
      ]);
    });

    it('applies search filters to both quality and platform counts', () => {
      const result = repo.getFilterCounts({ search: 'ios' });

      expect(result.qualityCounts).toEqual([
        { quality: 'good', count: 1 },
        { quality: 'bad', count: 0 }
      ]);
      expect(result.platformCounts).toEqual([{ platform: 'ios', count: 1 }]);
    });

    it('applies capacity filters to both quality and platform counts', () => {
      const result = repo.getFilterCounts({ minCapacity: 10, maxCapacity: 30 });

      expect(result.qualityCounts).toEqual([
        { quality: 'good', count: 0 },
        { quality: 'bad', count: 1 }
      ]);
      expect(result.platformCounts).toEqual([
        { platform: 'android', count: 2 },
        { platform: 'standalonewindows', count: 1 }
      ]);
    });

    it('excludes worlds without a quality from quality counts', () => {
      const result = repo.getFilterCounts({ tags: ['horror'] });

      expect(
        result.qualityCounts.find((q) => q.quality === 'good')?.count
      ).toBe(1);
      expect(result.qualityCounts.find((q) => q.quality === 'bad')?.count).toBe(
        1
      );
    });

    it('counts a multi-platform world once per platform', () => {
      const result = repo.getFilterCounts({ worldIds: ['wrld_unrated'] });

      expect(result.platformCounts).toEqual([
        { platform: 'android', count: 1 },
        { platform: 'standalonewindows', count: 1 }
      ]);
    });

    it('combines quality and platform filters for the opposite facet', () => {
      const result = repo.getFilterCounts({
        quality: ['good'],
        platforms: ['standalonewindows']
      });

      expect(result.qualityCounts).toEqual([
        { quality: 'good', count: 1 },
        { quality: 'bad', count: 0 }
      ]);
      expect(result.platformCounts).toEqual([
        { platform: 'ios', count: 1 },
        { platform: 'standalonewindows', count: 1 }
      ]);
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
