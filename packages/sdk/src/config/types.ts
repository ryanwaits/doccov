/**
 * Configuration types for Drift.
 * These types are shared between CLI and API — the CLI's drift.config.json
 * (or package.json "drift" key) validates against this same shape. A JSON
 * Schema for editors/agents ships with the CLI as drift.config.schema.json.
 */

/**
 * Remote repo whose docs should be synced on breaking changes.
 */
export interface RemoteDocsTarget {
  /** Target repo in "owner/repo" format */
  repo: string;
  /** Target branch (defaults to repo's default branch) */
  branch?: string;
}

/**
 * Documentation configuration options.
 */
export interface DocsConfig {
  /** Glob patterns for markdown docs to include */
  include?: string[];
  /** Glob patterns for markdown docs to exclude */
  exclude?: string[];
  /** Remote repos to sync docs on breaking changes */
  remote?: RemoteDocsTarget[];
}

/**
 * Coverage threshold configuration.
 */
export interface CoverageConfig {
  /** Minimum coverage % (exit 1 if below) */
  min?: number;
  /** Ratchet: effective min = max(min, highest_ever) */
  ratchet?: boolean;
}

/**
 * Example validation modes.
 */
export type ExampleValidationMode = 'presence' | 'typecheck' | 'run';

/**
 * Example execution policy.
 */
export interface ExamplesConfig {
  /** Allow --run in non-TTY (CI) without --yes */
  run?: boolean;
}

/**
 * Normalized Drift configuration.
 */
export interface DriftConfig {
  /** Entry point override (otherwise auto-detected) */
  entry?: string;
  /** Export include patterns */
  include?: string[];
  /** Export exclude patterns */
  exclude?: string[];
  /** Coverage thresholds */
  coverage?: CoverageConfig;
  /** Enable lint checks (default true) */
  lint?: boolean;
  /** Documentation configuration */
  docs?: DocsConfig;
  /** Example execution policy */
  examples?: ExamplesConfig;
}

/**
 * Define a Drift configuration.
 * Helper function for type-safe configuration in drift.config.ts.
 *
 * @param config - Configuration object
 * @returns The configuration object (for type inference)
 *
 * @example
 * ```typescript
 * import { defineConfig } from '@driftdev/sdk';
 *
 * export default defineConfig({
 *   include: ['MyClass', 'myFunction'],
 *   exclude: ['internal*'],
 *   docs: { include: ['docs/*.md'] },
 * });
 * ```
 */
export function defineConfig(config: DriftConfig): DriftConfig {
  return config;
}
