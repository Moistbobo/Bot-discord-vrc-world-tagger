import { FastifyInstance } from 'fastify';

jest.mock('../assets/config', () => ({
  API_PORT: 3000,
  API_TOKEN: ['test-token'],
  API_ALLOWED_ORIGINS: [
    'https://allowed.example.com',
    'https://sos-world-dashboard-git-*-teambobo-s-projects.vercel.app'
  ],
  API_ALLOWED_IPS: ['203.0.113.42'],
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

function createMockRepo() {
  return {
    count: jest.fn(() => 1428),
    getAllPaginated: jest.fn(() => ({ total: 0, rows: [] })),
    getByWorldId: jest.fn(() => []),
    getUniqueTags: jest.fn(() => []),
    getFilterCounts: jest.fn(() => ({
      qualityCounts: [],
      platformCounts: []
    }))
  };
}

describe('API Server origin and IP restrictions', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = createApiServer();
    asMock(getWorldRepository).mockReturnValue(createMockRepo());
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('allows requests from an allowed origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        origin: 'https://allowed.example.com'
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects requests from a disallowed origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        origin: 'https://evil.example.com'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Forbidden' });
  });

  it('rejects requests without origin when origin allowlist is set', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Forbidden' });
  });

  it('allows requests from origins matching a wildcard pattern', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        origin:
          'https://sos-world-dashboard-git-main-teambobo-s-projects.vercel.app'
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('allows requests from another origin matching the same wildcard pattern', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        origin:
          'https://sos-world-dashboard-git-merge-main-t-453664-teambobo-s-projects.vercel.app'
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects requests from origins that do not match the wildcard pattern', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        origin: 'https://evil-dashboard-git-main-teambobo-s-projects.vercel.app'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Forbidden' });
  });

  it('rejects Vercel preview origins not under the teambobo-s-projects team', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        origin:
          'https://sos-world-dashboard-git-main-attacker-s-projects.vercel.app'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Forbidden' });
  });

  it('allows requests from an allowed IP', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        'x-forwarded-for': '203.0.113.42'
      },
      // Simulate a request arriving via a loopback proxy.
      remoteAddress: '127.0.0.1'
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects requests from a disallowed IP', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        'x-forwarded-for': '198.51.100.99'
      },
      remoteAddress: '127.0.0.1'
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual({ error: 'Forbidden' });
  });

  it('skips restriction checks for the health endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(response.statusCode).toBe(200);
  });
});
