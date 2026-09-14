/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@yorga/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
  },
  // La cobertura se mide sobre la LÓGICA de dominio de tareas (orden del tablero, claves), no sobre el
  // pegamento de framework ni los adapters de BD. El dominio de auth viene probado de `automatizaciones`.
  collectCoverageFrom: ['src/tareas/domain/**/*.ts'],
  coverageThreshold: { global: { statements: 85, branches: 75, functions: 85, lines: 85 } },
};
