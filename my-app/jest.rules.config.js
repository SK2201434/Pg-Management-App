// Firestore Security Rules tests. They need the Firestore emulator: run `npm run test:rules`
// (requires Java 11+; the Firebase CLI comes from devDependencies).
module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore-tests/**/*.test.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
