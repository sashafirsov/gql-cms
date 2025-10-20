/* eslint-disable */
const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'db-init',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  // Merged from package.json jest section to avoid implicit multi-config
  moduleFileExtensions: ['ts', 'js', 'json', 'html'],
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: 'test-output/jest/coverage',
};
