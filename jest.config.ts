import type { Config } from 'jest'
import { config } from 'dotenv'

config({ path: '.env.local' })

const jestConfig: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  roots: ['<rootDir>'],
  modulePaths: ['<rootDir>'],
  silent: true,
}

export default jestConfig
