jest.mock('./src/utils/apiClient', () => ({
  api: {
    addWorld: jest.fn(),
    deleteWorld: jest.fn(),
    setQuality: jest.fn(),
    setTags: jest.fn(),
    getWorld: jest.fn(),
    getWorldPairs: jest.fn(),
    getLastProcessedWorld: jest.fn(),
    getStats: jest.fn(),
    extractWorlds: jest.fn()
  },
  isApiError: jest.fn(),
  apiHealthCheck: jest.fn()
}));
