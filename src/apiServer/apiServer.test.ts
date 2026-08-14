import { FastifyInstance } from 'fastify';

// Mock config before importing anything that uses it
jest.mock('../assets/config', () => ({
  API_PORT: 3000,
  API_TOKEN: ['test-token'],
  API_ALLOWED_ORIGINS: [],
  API_ALLOWED_IPS: [],
  DISABLE_API_RESTRICTIONS: false
}));

jest.mock('../utils/database/worldRepository', () => ({
  getWorldRepository: jest.fn()
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

import { getWorldRepository } from '../utils/database/worldRepository';
import { createApiServer } from './index';

const asMock = <T extends (...args: any[]) => any>(fn: any) =>
  fn as jest.MockedFunction<T>;

function createMockRepo(overrides: Record<string, unknown> = {}) {
  return {
    count: jest.fn(() => 1428),
    getAllPaginated: jest.fn(() => ({
      total: 1,
      rows: [
        {
          worldId: 'wrld_abc123',
          name: 'Spooky Mansion',
          authorName: 'GhostDev',
          capacity: 16,
          platforms: ['standalonewindows', 'android'],
          tags: ['horror', 'game'],
          imageUrl: 'https://example.com/img.png',
          sourceContent: null,
          vrchatData: null,
          quality: 'good',
          createdAt: 1717257600,
          updatedAt: 1717257600
        }
      ]
    })),
    getByWorldId: jest.fn(() => [
      {
        worldId: 'wrld_abc123',
        name: 'Spooky Mansion',
        authorName: 'GhostDev',
        capacity: 16,
        platforms: ['standalonewindows', 'android'],
        tags: ['horror', 'game'],
        imageUrl: 'https://example.com/img.png',
        sourceContent: null,
        vrchatData: null,
        quality: 'good',
        createdAt: 1717257600,
        updatedAt: 1717257600
      }
    ]),
    getUniqueTags: jest.fn(() => [
      { tag: 'horror', count: 312 },
      { tag: 'game', count: 145 }
    ]),
    getMetadataCounts: jest.fn(() => ({
      qualityGood: 123,
      qualityBad: 12,
      platformDesktop: 80,
      platformAndroid: 45,
      platformiOS: 6
    })),
    ...overrides
  };
}

describe('API Server', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = createApiServer();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('returns health status without auth', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await app.inject({
        method: 'GET',
        url: '/api/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        status: 'ok',
        worldCount: 1428,
        dbVersion: 1
      });
    });
  });

  describe('Auth', () => {
    it('returns 401 when auth header is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds'
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
    });

    it('returns 401 when token is invalid', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds',
        headers: { authorization: 'Bearer wrong-token' }
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
    });

    it('allows access with a valid token', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /api/worlds', () => {
    it('returns paginated world list with sanitized fields', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.total).toBe(1);
      expect(body.limit).toBe(50);
      expect(body.offset).toBe(0);
      expect(body.worlds).toHaveLength(1);

      const world = body.worlds[0];
      expect(world.worldId).toBe('wrld_abc123');
      expect(world.name).toBe('Spooky Mansion');
      expect(world.vrchatUrl).toBe('https://vrchat.com/home/world/wrld_abc123');
      expect(world.quality).toBe('good');
      expect(world.createdAt).toBe('2024-06-01T16:00:00.000Z');

      // Server-identifying fields must be stripped
      expect(world.guildId).toBeUndefined();
      expect(world.messageId).toBeUndefined();
      expect(world.sourceContent).toBeUndefined();
      expect(world.vrchatData).toBeUndefined();
    });

    it('passes tag filters to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?tag=horror&tag=game',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ tags: ['horror', 'game'] })
      );
    });

    it('accepts comma-separated tags via ?tag=horror,game', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?tag=horror,game',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ tags: ['horror', 'game'] })
      );
    });

    it('accepts repeated tag params ?tag=horror&tag=game', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?tag=horror&tag=game',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ tags: ['horror', 'game'] })
      );
    });

    it('passes platform filters to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?platform=standalonewindows',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ platforms: ['standalonewindows'] })
      );
    });

    it('accepts comma-separated platforms via ?platform=standalonewindows,android', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?platform=standalonewindows,android',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ platforms: ['standalonewindows', 'android'] })
      );
    });

    it('accepts repeated platform params ?platform=standalonewindows&platform=android', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?platform=standalonewindows&platform=android',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ platforms: ['standalonewindows', 'android'] })
      );
    });

    it('passes quality filters to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?quality=good',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ quality: ['good'] })
      );
    });

    it('combines tag and quality filters', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?tag=horror&quality=bad',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ tags: ['horror'], quality: ['bad'] })
      );
    });

    it('passes search filter to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?search=ghostly',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ search: 'ghostly' })
      );
    });

    it('ignores empty or whitespace-only search query', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?search=%20%20',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(50, 0, undefined);
    });

    it('combines search, tag and quality filters', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?search=spooky&tag=horror&quality=good',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({
          search: 'spooky',
          tags: ['horror'],
          quality: ['good']
        })
      );
    });

    it('passes worldId filters to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?worldId=wrld_abc123',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ worldIds: ['wrld_abc123'] })
      );
    });

    it('accepts comma-separated worldIds via ?worldId=wrld_abc123,wrld_def456', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?worldId=wrld_abc123,wrld_def456',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ worldIds: ['wrld_abc123', 'wrld_def456'] })
      );
    });

    it('accepts repeated worldId params ?worldId=wrld_abc123&worldId=wrld_def456', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?worldId=wrld_abc123&worldId=wrld_def456',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ worldIds: ['wrld_abc123', 'wrld_def456'] })
      );
    });

    it('combines worldId filter with other filters', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?worldId=wrld_abc123,wrld_def456&tag=horror&quality=good',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({
          worldIds: ['wrld_abc123', 'wrld_def456'],
          tags: ['horror'],
          quality: ['good']
        })
      );
    });

    it('caps limit at 500', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?limit=9999',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(500, 0, undefined);
    });

    it('parses offset correctly', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?offset=100',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(50, 100, undefined);
    });

    it('passes minCapacity filter to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?minCapacity=10',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ minCapacity: 10 })
      );
    });

    it('passes maxCapacity filter to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?maxCapacity=40',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ maxCapacity: 40 })
      );
    });

    it('combines capacity range with tag, quality, and search filters', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?minCapacity=10&maxCapacity=40&quality=good&tag=horror&search=spooky',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({
          minCapacity: 10,
          maxCapacity: 40,
          quality: ['good'],
          tags: ['horror'],
          search: 'spooky'
        })
      );
    });

    it('combines platform filter with other filters', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?platform=standalonewindows&platform=android&quality=good&tag=horror',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({
          platforms: ['standalonewindows', 'android'],
          quality: ['good'],
          tags: ['horror']
        })
      );
    });

    it('returns 400 when minCapacity is greater than maxCapacity', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds?minCapacity=50&maxCapacity=20',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'minCapacity must be less than or equal to maxCapacity'
      });
    });

    it('returns 400 when minCapacity is below 1', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds?minCapacity=0',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'minCapacity must be at least 1'
      });
    });

    it('returns 400 when maxCapacity is above 80', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds?maxCapacity=81',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'maxCapacity must be at most 80'
      });
    });

    it('returns 400 for non-integer capacity values', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds?minCapacity=abc',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(400);
      expect(JSON.parse(response.body)).toEqual({
        error: 'minCapacity must be an integer'
      });
    });

    it('passes dayRange filter to repository', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?dayRange=7',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ dayRange: 7 })
      );
    });

    it('clamps dayRange above 365 to 365', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?dayRange=999',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ dayRange: 365 })
      );
    });

    it('treats negative dayRange as no filter', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?dayRange=-5',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(50, 0, undefined);
    });

    it('treats zero dayRange as no filter', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?dayRange=0',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(50, 0, undefined);
    });

    it('treats non-numeric dayRange as no filter', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?dayRange=abc',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(50, 0, undefined);
    });

    it('combines dayRange filter with tag filter', async () => {
      const getAllPaginated = jest.fn(() => ({ total: 0, rows: [] }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getAllPaginated })
      );

      await app.inject({
        method: 'GET',
        url: '/api/worlds?dayRange=7&tag=horror',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getAllPaginated).toHaveBeenCalledWith(
        50,
        0,
        expect.objectContaining({ dayRange: 7, tags: ['horror'] })
      );
    });
  });

  describe('GET /api/worlds/:worldId', () => {
    it('returns a single world with vrchatUrl and quality', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds/wrld_abc123',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.worldId).toBe('wrld_abc123');
      expect(body.vrchatUrl).toBe('https://vrchat.com/home/world/wrld_abc123');
      expect(body.quality).toBe('good');

      // Stripped fields
      expect(body.guildId).toBeUndefined();
      expect(body.sourceContent).toBeUndefined();
    });

    it('returns 404 when world does not exist', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getByWorldId: jest.fn(() => []) })
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds/wrld_missing',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({
        error: 'World not found'
      });
    });
  });

  describe('GET /api/tags', () => {
    it('returns unique tags with counts', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tags).toEqual([
        { tag: 'horror', count: 312 },
        { tag: 'game', count: 145 }
      ]);
    });
  });

  describe('GET /api/meta', () => {
    it('returns quality and platform metadata counts', async () => {
      asMock(getWorldRepository).mockReturnValue(createMockRepo());

      const response = await app.inject({
        method: 'GET',
        url: '/api/meta',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toEqual({
        qualityGood: 123,
        qualityBad: 12,
        platformDesktop: 80,
        platformAndroid: 45,
        platformiOS: 6
      });
    });

    it('calls getMetadataCounts on the repository', async () => {
      const getMetadataCounts = jest.fn(() => ({
        qualityGood: 0,
        qualityBad: 0,
        platformDesktop: 0,
        platformAndroid: 0,
        platformiOS: 0
      }));
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({ getMetadataCounts })
      );

      await app.inject({
        method: 'GET',
        url: '/api/meta',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(getMetadataCounts).toHaveBeenCalledTimes(1);
    });

    it('returns 401 without a valid token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/meta'
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toEqual({ error: 'Unauthorized' });
    });
  });

  describe('Error handling', () => {
    it('returns clean JSON 404 for unmatched routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/not-a-route',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(404);
      expect(JSON.parse(response.body)).toEqual({ error: 'Not Found' });
    });

    it('sanitizes 500 errors from route handlers', async () => {
      asMock(getWorldRepository).mockReturnValue(
        createMockRepo({
          getAllPaginated: jest.fn(() => {
            throw new Error('database exploded');
          })
        })
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/worlds',
        headers: { authorization: 'Bearer test-token' }
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
      expect(body).not.toHaveProperty('stack');
    });
  });
});
