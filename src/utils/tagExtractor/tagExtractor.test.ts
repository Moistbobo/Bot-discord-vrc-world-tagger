import { extractTags } from './index';

describe('tagExtractor', () => {
  describe('hashtag pass', () => {
    it('extracts basic hashtags', () => {
      expect(extractTags('#horror #game')).toEqual(['horror', 'game']);
    });

    it('extracts Japanese hashtags', () => {
      expect(extractTags('#ホラー #ゲーム')).toEqual([]); // not in taxonomy
    });

    it('deduplicates hashtags', () => {
      expect(extractTags('#horror #horror')).toEqual(['horror']);
    });

    it('normalizes case', () => {
      expect(extractTags('#Horror #GAME')).toEqual(['horror', 'game']);
    });

    it('ignores non-taxonomy hashtags', () => {
      expect(extractTags('#horror #randomstuff')).toEqual(['horror']);
    });

    it('canonicalizes #vrmv to particle live / vrmv', () => {
      expect(extractTags('#vrmv')).toEqual(['particle live / vrmv']);
    });

    it('canonicalizes #particlelive to particle live / vrmv', () => {
      expect(extractTags('#particlelive')).toEqual(['particle live / vrmv']);
    });
  });

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
  });

  describe('inline / loose prose pass', () => {
    it('extracts tags from natural sentences', () => {
      expect(extractTags('A chill horror world with puzzle elements')).toEqual([
        'chill',
        'horror',
        'puzzle'
      ]);
    });

    it('does not match substrings', () => {
      // "gamergate" contains "game" but shouldn't match
      expect(extractTags('gamergate')).toEqual([]);
      // "horrifying" contains "horror" but shouldn't match
      expect(extractTags('horrifying')).toEqual([]);
    });

    it('matches at word boundaries', () => {
      expect(extractTags('This is a game world.')).toEqual(['game']);
      expect(extractTags('A nature-themed map')).toEqual(['nature']);
    });

    it('matches multi-word canonical tag in prose', () => {
      expect(extractTags('A particle live showcase')).toEqual([
        'particle live / vrmv'
      ]);
      expect(extractTags('A VRMV performance')).toEqual([
        'particle live / vrmv'
      ]);
    });

    it('matches tags surrounded by punctuation', () => {
      expect(extractTags('Tags: (horror), [game], {chill}')).toEqual([
        'horror',
        'game',
        'chill'
      ]);
    });
  });

  describe('cross-strategy deduplication', () => {
    it('deduplicates across all passes in first-appearance order', () => {
      const content = '#horror Tags: horror A horror world';
      expect(extractTags(content)).toEqual(['horror']);
    });

    it('keeps first-appearance order across passes', () => {
      const content = '#game Tags: horror Inline: chill';
      // hashtag pass: game
      // structured pass: horror
      // inline pass: chill (horror already seen)
      expect(extractTags(content)).toEqual(['game', 'horror', 'chill']);
    });
  });

  describe('canonicalization', () => {
    it('normalizes vrmv variants', () => {
      expect(extractTags('VRMV')).toEqual(['particle live / vrmv']);
      expect(extractTags('particle live')).toEqual(['particle live / vrmv']);
      expect(extractTags('particlelive')).toEqual(['particle live / vrmv']);
    });

    it('does not double-count canonicalized variants', () => {
      expect(extractTags('#vrmv particle live')).toEqual([
        'particle live / vrmv'
      ]);
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

    it('returns empty when no taxonomy tags found', () => {
      expect(extractTags('Just some random text about cats')).toEqual([]);
    });

    it('handles mixed valid and invalid', () => {
      expect(
        extractTags('Tags: horror, adventure, randomword #game #nope')
      ).toEqual(['game', 'horror', 'adventure']);
    });
  });
});
