/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  collectCoverage: true,
  coverageReporters: ["json", "lcov", "text", "clover"]
};
