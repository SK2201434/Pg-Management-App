module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/firestore-tests/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
