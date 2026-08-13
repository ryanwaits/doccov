/**
 * Configuration module - types and validation for Drift configuration.
 */

// Zod schema for config validation (used by CLI)
export type { DriftConfigInput } from './schema';
export { driftConfigSchema, normalizeConfig } from './schema';
export type {
  CoverageConfig,
  DocsConfig,
  DriftConfig,
  ExamplesConfig,
  ExampleValidationMode,
  RemoteDocsTarget,
} from './types';
export { defineConfig } from './types';
