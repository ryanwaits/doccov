/**
 * Drift SDK - Documentation coverage and drift detection for TypeScript.
 *
 * This is the main entry point with core functionality.
 * For specialized utilities, use subpath imports:
 *
 * @example
 * ```ts
 * // Core API (this module)
 * import { Drift, scan, buildDriftSpec, computeDrift } from '@driftdev/sdk';
 *
 * // Subpaths
 * import { discoverMarkdownFiles } from '@driftdev/sdk/markdown';
 * import { validateExamples } from '@driftdev/sdk/examples';
 * import { computeSnapshot } from '@driftdev/sdk/history';
 * import { loadSpecCache } from '@driftdev/sdk/cache';
 * ```
 *
 * @module @driftdev/sdk
 */

// ─────────────────────────────────────────────────────────────────────────────
// Spec Types & Validation (from consolidated @driftdev/spec)
// ─────────────────────────────────────────────────────────────────────────────

export type {
  ApiSurfaceResult,
  DocumentationHealth,
  DriftIssue,
  DriftSchemaVersion,
  DriftSpec,
  DriftSpecError,
  DriftSpecVersion,
  ExampleAnalysis,
  ExampleRuntimeDrift,
  ExampleTypecheckError,
  ExportAnalysis,
  ForgottenExport,
  MissingDocRule,
  TypeReferenceLocation,
} from './spec';
export {
  assertDriftSpec,
  getAvailableDriftVersions,
  getDriftValidationErrors,
  LATEST_VERSION,
  SCHEMA_URL,
  SCHEMA_VERSION,
  validateDriftSpec,
} from './spec';

// ─────────────────────────────────────────────────────────────────────────────
// Core Analysis API
// ─────────────────────────────────────────────────────────────────────────────

// Batch analysis
export type { BatchResult, PackageResult } from './analysis/batch';
export { aggregateResults, createPackageResult } from './analysis/batch';
export type {
  CategorizedDrift,
  DriftCategory,
  DriftResult,
  DriftSummary,
  DriftType,
  SpecDocDrift,
} from './analysis/docs-coverage';
// Drift detection (most commonly used)
export {
  buildExportRegistry,
  computeDrift,
  computeExportDrift,
  DRIFT_CATEGORIES,
  DRIFT_CATEGORY_DESCRIPTIONS,
  DRIFT_CATEGORY_LABELS,
} from './analysis/docs-coverage';
// Drift options
export type { ComputeDriftOptions } from './analysis/drift/compute';
export type { BuildDriftOptions } from './analysis/drift-builder';
// Drift spec builder
export { buildDriftSpec } from './analysis/drift-builder';
// Health computation
export type { HealthInput } from './analysis/health';
export {
  computeHealth,
  EXTERNAL_SOURCE_FILE,
  isExportDocumented,
  isExternalExport,
} from './analysis/health';
// Incremental analysis (crash recovery)
export type {
  IncrementalAnalyzerOptions,
  IncrementalExportResult,
  PartialAnalysisState,
} from './analysis/incremental';
export {
  cleanupOrphanedTempFiles,
  findOrphanedTempFiles,
  IncrementalAnalyzer,
} from './analysis/incremental';
export type {
  DocsKeyCorpus,
  KeyAnnotation,
  KeyCoverageOptions,
  KeyCoverageResult,
  KeyGap,
  KeyGhost,
  KeyInversion,
} from './analysis/key-coverage';
// Docs-page key coverage (gaps/ghosts/inversions vs a docs corpus)
export {
  collectAllTypeKeys,
  collectTypeKeys,
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
  findTypeEntry,
} from './analysis/key-coverage';
// Lookup helpers (for composition pattern)
export {
  getExportAnalysis,
  getExportDrift,
  getExportMissing,
  getExportScore,
  isExportFullyDocumented,
} from './analysis/lookup';
// Module graph for cross-module @link validation
export type { ModuleGraph, ModuleInfo } from './analysis/module-graph';
export { buildModuleGraph, findSymbolModule, symbolExistsInGraph } from './analysis/module-graph';
// Report generation
export { generateReport, renderApiSurface } from './analysis/report';
// Spec types
export type { OpenPkgSpec } from './analysis/spec-types';
export type {
  AnalysisResult,
  AnalyzeOptions,
  Diagnostic,
  ForgottenExportResult,
  ScanOptions,
} from './analyzer';
export { analyze, analyzeFile, Drift, scan } from './analyzer';
export type { DriftOptions } from './options';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

export type {
  CoverageConfig,
  DocsConfig,
  DriftConfig,
  DriftConfigInput,
  ExamplesConfig,
  RemoteDocsTarget,
} from './config';
export { defineConfig, driftConfigSchema, normalizeConfig } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Project Resolution & Detection
// ─────────────────────────────────────────────────────────────────────────────

export type { FileSystem, PackageJson, PackageManager, ProjectInfo } from './detect';
export { analyzeProject, detectPackageManager, NodeFileSystem } from './detect';
export type { ResolvedTarget, ResolveTargetOptions } from './resolve';
export { resolveTarget } from './resolve';

// ─────────────────────────────────────────────────────────────────────────────
// Example Validation — @deprecated Use @driftdev/sdk/examples
// ─────────────────────────────────────────────────────────────────────────────

export type { ExampleValidation } from './examples/types';
export { parseExamplesFlag } from './examples/types';
export type {
  ExampleValidationOptions,
  ExampleValidationResult,
} from './examples/validator';
export { validateExamples } from './examples/validator';

// ─────────────────────────────────────────────────────────────────────────────
// Markdown Analysis — @deprecated Use @driftdev/sdk/markdown
// ─────────────────────────────────────────────────────────────────────────────

export { detectProseDrift, type ProseDriftOptions } from './analysis/drift/prose-drift';
export { discoverMarkdownFiles } from './markdown/discover';
export { findExportReferences, parseMarkdownFiles } from './markdown/parser';
export type { MarkdownCodeBlock, MarkdownDocFile } from './markdown/types';

// ─────────────────────────────────────────────────────────────────────────────
// Report Types (commonly needed)
// ─────────────────────────────────────────────────────────────────────────────

export type { CoverageSummary, DriftReport, ExportCoverageData } from './types/report';

// ─────────────────────────────────────────────────────────────────────────────
// Filter Types (commonly needed)
// ─────────────────────────────────────────────────────────────────────────────

export type { FilterOptions, ReleaseTag } from './filtering/types';

// ─────────────────────────────────────────────────────────────────────────────
// Typecheck
// ─────────────────────────────────────────────────────────────────────────────

export type { ExampleTypeError, TypecheckResult } from './typecheck';
export { typecheckExamples } from './typecheck';

// ─────────────────────────────────────────────────────────────────────────────
// Additional Exports removed — use subpath imports instead:
//   @driftdev/sdk/analysis, @driftdev/sdk/history, @driftdev/sdk/cache,
//   @driftdev/sdk/markdown, @driftdev/sdk/examples, @driftdev/sdk/types
// ─────────────────────────────────────────────────────────────────────────────
