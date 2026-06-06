import { extractTags } from './index';

describe('tagExtractor', () => {
  describe('structured prefix pass', () => {
    it('extracts from "Tags:" lines', () => {
      expect(extractTags('Tags: horror')).toEqual(['horror']);
    });

    it('extracts from "Tag:" lines', () => {
      expect(extractTags('Tag: game')).toEqual(['game']);
    });

    it('extracts from "Category:" lines', () => {
      expect(extractTags('Category: chill')).toEqual(['chill']);
    });

    it('extracts comma-separated tags', () => {
      expect(extractTags('Tags: horror, game, chill')).toEqual([
        'horror',
        'game',
        'chill'
      ]);
    });

    it('extracts space-separated tags', () => {
      expect(extractTags('Tags: horror game chill')).toEqual([
        'horror',
        'game',
        'chill'
      ]);
    });

    it('extracts from "Type:" prefix', () => {
      expect(extractTags('Type: adventure')).toEqual(['adventure']);
    });

    it('ignores non-taxonomy values', () => {
      expect(extractTags('Tags: horror, notatag')).toEqual(['horror']);
    });

    it('handles multiple tag lines', () => {
      expect(extractTags('Tags: horror\nTags: game\nTags: chill')).toEqual([
        'horror',
        'game',
        'chill'
      ]);
    });

    it('handles Japanese prefixes', () => {
      expect(extractTags('タグ: horror')).toEqual(['horror']);
    });

    it('deduplicates across structured lines', () => {
      expect(extractTags('Tags: horror\nTag: horror')).toEqual(['horror']);
    });

    it('handles full-width colon', () => {
      expect(extractTags('Tags：horror')).toEqual(['horror']);
    });

    it('handles brackets and quotes around tags', () => {
      expect(extractTags('Tags: (horror), [game], {chill}')).toEqual([
        'horror',
        'game',
        'chill'
      ]);
    });
  });

  describe('canonicalization', () => {
    it('normalizes vrmv variants in structured lines', () => {
      expect(extractTags('Tags: VRMV')).toEqual(['particle live / vrmv']);
      expect(extractTags('Tags: particle live')).toEqual([
        'particle live / vrmv'
      ]);
      expect(extractTags('Tags: particlelive')).toEqual([
        'particle live / vrmv'
      ]);
    });

    it('does not double-count canonicalized variants', () => {
      expect(extractTags('Tags: vrmv, particle live')).toEqual([
        'particle live / vrmv'
      ]);
    });

    it('canonicalizes Japanese variant', () => {
      expect(extractTags('Tags: パーティクルライブ')).toEqual([
        'particle live / vrmv'
      ]);
    });
  });

  describe('ignores unstructured content', () => {
    it('ignores hashtags', () => {
      expect(extractTags('#horror #game')).toEqual([]);
    });

    it('ignores inline prose', () => {
      expect(
        extractTags('A chill horror world with puzzle elements')
      ).toEqual([]);
    });

    it('ignores substrings in prose', () => {
      expect(extractTags('gamergate horrifying')).toEqual([]);
    });

    it('ignores standalone words without a prefix', () => {
      expect(extractTags('horror game chill')).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('returns empty for empty string', () => {
      expect(extractTags('')).toEqual([]);
    });

    it('returns empty for null/undefined', () => {
      expect(extractTags(null as unknown as string)).toEqual([]);
      expect(extractTags(undefined as unknown as string)).toEqual([]);
    });

    it('returns empty when no structured tag lines found', () => {
      expect(extractTags('Just some random text about cats')).toEqual([]);
    });

    it('returns empty when prefix has no content', () => {
      expect(extractTags('Tags:')).toEqual([]);
    });
  });
});
