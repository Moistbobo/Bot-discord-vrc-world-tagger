vi.mock('./src/utils/apiClient', () => ({
  api: {
    addWorld: vi.fn(),
    deleteWorld: vi.fn(),
    setQuality: vi.fn(),
    setHighPriority: vi.fn(),
    removeHighPriority: vi.fn(),
    setTags: vi.fn(),
    getWorld: vi.fn(),
    getWorldPairs: vi.fn(),
    getLastProcessedWorld: vi.fn(),
    getStats: vi.fn(),
    extractWorlds: vi.fn()
  },
  isApiError: vi.fn(),
  apiHealthCheck: vi.fn()
}));
