jest.mock('./src/utils/externalApi/vrchat', () => ({
  VRChat: jest.fn(),
  vrchat: {
    client: {},
    getWorld: jest.fn(),
    getFile: jest.fn(),
    searchUsers: jest.fn(),
    searchWorlds: jest.fn()
  },
  isCurrentUser: jest.fn(),
  getUserIdByName: jest.fn(),
  searchByWorldName: jest.fn()
}));
