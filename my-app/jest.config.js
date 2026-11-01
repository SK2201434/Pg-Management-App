module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/firestore-tests/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  // SDK 58's jest-expo requires expo-modules-core, which npm installs nested inside `expo`.
  modulePaths: ['<rootDir>/node_modules/expo/node_modules'],
};
