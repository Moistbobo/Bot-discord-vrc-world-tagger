import { extractTags } from './index';
import { cleanContentForTagExtraction } from '../../utils/regex';

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
      expect(extractTags('A chill horror world with puzzle elements')).toEqual(
        []
      );
    });

    it('ignores substrings in prose', () => {
      expect(extractTags('gamergate horrifying')).toEqual([]);
    });

    it('extracts standalone words that are all taxonomy terms', () => {
      expect(extractTags('horror game chill')).toEqual([
        'horror',
        'game',
        'chill'
      ]);
    });

    it('extracts inline tags after a URL when cleaned', () => {
      const cleaned = cleanContentForTagExtraction(
        'https://fixupx.com/minhyn01/status/2062648087517016481 kino, chill'
      );
      expect(extractTags(cleaned)).toEqual(['kino', 'chill']);
    });

    it('extracts space-separated inline tags after a URL', () => {
      const cleaned = cleanContentForTagExtraction(
        'https://fixupx.com/minhyn01/status/2062648087517016481 kino chill'
      );
      expect(extractTags(cleaned)).toEqual(['kino', 'chill']);
    });

    it('still ignores inline prose with non-taxonomy words', () => {
      expect(extractTags('A chill horror world with puzzle elements')).toEqual(
        []
      );
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

    it('strips trailing ? . ! from tags in structured lines', () => {
      expect(extractTags('Tags: chill, kino?')).toEqual(['chill', 'kino']);
      expect(extractTags('Tags: kino. chill!')).toEqual(['kino', 'chill']);
    });

    it('returns empty when prefix has no content', () => {
      expect(extractTags('Tags:')).toEqual([]);
    });
  });

  describe('real-world message formats', () => {
    const clean = cleanContentForTagExtraction;

    it('Format 1 — URL + Tags prefix', () => {
      const msg =
        'https://fixupx.com/minhyn01/status/2062648087517016481\nTags: kino, chill';
      expect(extractTags(clean(msg))).toEqual(['kino', 'chill']);
    });

    it('Format 2 — URL + inline tags (no prefix)', () => {
      const msg =
        'https://fixupx.com/minhyn01/status/2062648087517016481 kino chill';
      expect(extractTags(clean(msg))).toEqual(['kino', 'chill']);
    });

    it('Format 3 — URL + Tags prefix (3 tags)', () => {
      const msg =
        'https://fixupx.com/Bradlee1011/status/2063087928151044100\nTags: adventure, gamerip, kino';
      expect(extractTags(clean(msg))).toEqual(['adventure', 'gamerip', 'kino']);
    });

    it('Format 4 — direct world link + single tag', () => {
      const msg =
        'https://vrchat.com/home/world/wrld_261a4ff0-1a46-4a86-9bd5-ec2160f1c689 kino';
      expect(extractTags(clean(msg))).toEqual(['kino']);
    });

    it('Format 5 — direct link + tags + description on next line', () => {
      const msg =
        'https://vrchat.com/home/world/wrld_f655391d-7be0-419c-9d0b-8b8c842d8d17 comfy chill\nbig mansion by the beach';
      expect(extractTags(clean(msg))).toEqual(['comfy', 'chill']);
    });

    it('Format 6 — direct link + tags + prose (majority valid)', () => {
      const msg =
        'https://vrchat.com/home/world/wrld_e8d2f69c-fa79-4de3-ade6-1d7635f19c67 meme game (little) horror\ni think you have to collect some items or something goal is unclear :Shrug:';
      expect(extractTags(clean(msg))).toEqual(['meme', 'game', 'horror']);
    });

    it('Format 7 — direct link + tech + canonicalized VRMV', () => {
      const msg =
        'https://vrchat.com/home/world/wrld_d8803d30-f34e-48ee-a6e6-0c4c53e20b62 tech VRMV';
      expect(extractTags(clean(msg))).toEqual(['tech', 'particle live / vrmv']);
    });

    it('Format 8 — /info link + single tag', () => {
      const msg =
        'https://vrchat.com/home/world/wrld_72b49c0d-527b-4bad-b39a-b265bcb3f497/info game';
      expect(extractTags(clean(msg))).toEqual(['game']);
    });

    it('Format 9 — direct link + 2 tags', () => {
      const msg =
        'https://vrchat.com/home/world/wrld_9d95e56c-c041-4e13-b030-1cde04405658 chill kino';
      expect(extractTags(clean(msg))).toEqual(['chill', 'kino']);
    });
  });
});
