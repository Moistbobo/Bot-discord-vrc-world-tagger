import { FastifyInstance } from 'fastify';

jest.mock('../assets/config', () => ({
  API_PORT: 3000,
  API_TOKEN: ['test-token'],
  API_ALLOWED_ORIGINS: ['https://allowed.example.com'],
  API_ALLOWED_IPS: ['203.0.113.42'],
  DISABLE_API_RESTRICTIONS: true
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
    getMetadataCounts: jest.fn(() => ({
      qualityGood: 0,
      qualityBad: 0,
      platformDesktop: 0,
      platformAndroid: 0,
      platformiOS: 0
    }))
  };
}

describe('API Server with restrictions disabled', () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = createApiServer();
    asMock(getWorldRepository).mockReturnValue(createMockRepo());
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('allows requests from any origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        origin: 'https://evil.example.com'
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('allows requests without an origin header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token'
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it('allows requests from any IP', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/worlds',
      headers: {
        authorization: 'Bearer test-token',
        'x-forwarded-for': '198.51.100.99'
      },
      remoteAddress: '127.0.0.1'
    });

    expect(response.statusCode).toBe(200);
  });
});
