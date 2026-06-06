import { FastifyInstance } from 'fastify';

// Mock config before importing anything that uses it
jest.mock('../assets/config', () => ({
  API_PORT: 3000,
  API_TOKEN: ['test-token']
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
