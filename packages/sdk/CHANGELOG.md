# @doccov/sdk

## 1.14.0

### Minor Changes

- 2e20375: `--run` no longer executes every `@example` block, and the install/timeout path is no longer a hang or a script runner.

  - **Go polarity:** examples without a `// =>` assertion are type-checked and skipped at run time. Execution is opt-in via the assertion itself.
  - **Install:** `--ignore-scripts` on npm/pnpm/yarn/bun, plus `trustedDependencies: []` in the harness `package.json` so Bun's default-trusted list cannot run lifecycle scripts. Local packages are staged with `scripts` stripped first — npm still runs the target's `prepare` while packing a directory, even with `--ignore-scripts`. Failed installs are not retried with scripts enabled.
  - **Timeout:** examples spawn detached; the process group is SIGKILL'd on timeout; the promise resolves on `'exit'` (with a hard deadline) so a pipe-holding grandchild cannot stall `--run`.
  - **Untrusted packages** (outside the local workspace, or `--untrusted`): macOS `sandbox-exec` denies network and credential paths; `node --permission` sits underneath as defense in depth. Other platforms refuse rather than run unsandboxed. Own-package / CI is unsandboxed so real SDK examples can still call APIs.
  - **Env allowlist** (`PATH`, `HOME`, `TMPDIR`, `LANG`) on install and example spawns.
  - **`--yes`** or `examples.run` in config is required for `--run` when not a TTY.
  - Docs: `--run` no longer claims to execute "in a sandbox." The warning now says it installs the package.

## 1.13.0

### Minor Changes

- f3a960c: Bump `@openpkg-ts/sdk` to ^0.51.0 and `@openpkg-ts/spec` to ^0.50.0, up from ^0.43.0.

  No drift API changes, but extracted specs change: `x-ts-type` property coverage, `x-ts-declared`, `inlineTags`, `typeParameters`, JSON Schema 2020-12 output, and the declaration-keyed `resolveTypeId` collision fix all come through from the extractor.

## 1.12.2

### Patch Changes

- f8dcc01: `drift scan --docs-map` now runs standalone in docs-only repos: when every
  page in the map carries its own `spec` (or `entry`), no package entry point is
  required — previously scan exited 2 with "Could not detect entry point" in
  repos with no TypeScript package (the exact shape of a docs site gating SDK
  pages against committed specs). In standalone mode the output contains only
  `docsCoverage`; package `coverage`/`lint`/`health` are omitted.

  Also: `--annotations` now emits workspace-relative `file=` paths (GitHub only
  anchors annotations to the Files Changed view for relative paths), and the SDK
  key-coverage analysis accepts types-only specs (no `exports` array) without
  crashing.

## 1.12.0

### Minor Changes

- 5dde386: Docs-page key-coverage mode: diff a spec type's option keys against what a docs page actually documents

  - **SDK** `analysis/key-coverage`: `extractDocumentedKeys` (table keys — plain/linked/dotted/`<br/>`-embedded — with heading-scoped sections) + `computeKeyCoverage` (gaps/ghosts/inversions). Ghosts resolve against ALL spec types (sub-config tables aren't false ghosts); inversion replacements auto-derive from `@deprecated Use X instead` metadata.
  - **CLI** `drift scan --docs-map <file>`: key-coverage gate — FAIL any ghost, FAIL gaps above the committed `baselineGaps` ratchet, WARN inversions. `--annotations` on scan emits GitHub Actions `::error`/`::warning`. JSON Schema ships at `@driftdev/cli/schemas/drift.docs-map.schema.json`.
  - **CLI** `drift docs-map stub` (deterministic scaffold: pages ↔ types ranked by key overlap) and `drift docs-map baseline` (ratchet tightening — never raises).
  - **Prose-drift false-positive fix**: member calls on receivers provably bound to non-package types (external-derived like `const app = express()`, untyped callback params like `res`) are no longer flagged; params annotated with a package type are still validated.
  - **Spec cache** keys now include the CLI version — an upgraded extractor never serves stale specs.
  - New skill `drift-docs-map` (agent bootstraps the map, human commits, machine runs it).

## 1.11.0

### Minor Changes

- Upgrade extraction pipeline to @openpkg-ts/sdk ^0.43.0 (+spec ^0.43.0): per-property `description` and `@deprecated` now survive alias flattening (`Omit<Base, K> & {...}`), underscore-prefixed members are no longer dropped, and wide types are no longer silently truncated. Restores the metadata needed for deprecation/inversion detection on flattened option types.

## 1.10.0

### Minor Changes

- 820cfe2: Agent-native hardening: deterministic output, exit-code taxonomy, MCP parity, config schema

  - **Reproducible output**: `SOURCE_DATE_EPOCH` (reproducible-builds convention) makes JSON byte-stable — `meta.duration` reports 0, spec/report `generatedAt` derives from the epoch. Extracted specs now carry `$schema`.
  - **Exit codes now follow the grep convention**: 0 = clean, 1 = findings/threshold missed/not found, 2 = usage or internal error. Previously all failures exited 1; scripts checking `== 1` for errors should check `>= 1` or `== 2`.
  - **MCP parity**: `drift mcp` gains `drift_lint`, `drift_coverage`, `drift_health` — the documented fix loop now works for MCP-only clients.
  - **`drift lint --annotations`**: emit GitHub Actions `::error file=…,line=…` annotations for inline PR findings.
  - **One config schema**: SDK `driftConfigSchema`/`DriftConfig` now match the CLI's real config shape (`entry`, `coverage`, `lint`, `docs.remote`); JSON Schema ships at `@driftdev/cli/schemas/drift.config.schema.json`; `drift init` stamps `$schema`; `$schema` key allowed (and ignored) in `drift.config.json`.
  - New skills `drift-fix` and `drift-enrich` (previously dangling references from `scan`/`lint` `next` hints).

## 1.9.0

### Minor Changes

- e11d224: Bump @openpkg-ts/sdk to ^0.40.0: extraction now flattens mapped/conditional type aliases into members (with `@deprecated` recovered from conditional arm aliases), gives function-type aliases real signatures, and defaults to strict so `T | undefined` unions survive. Combined with 1.8's instance typing, `prose-deprecated-reference` now works on wasm/proxy surfaces — e.g. `drift lint <clarinet-sdk> --docs guides/` deterministically flags `simnet.runSnippet` with "use `simnet.execute(command)` instead".

## 1.8.0

### Minor Changes

- 7ea54de: Instance typing for prose-deprecated-reference. The registry now maps callable exports to their named return types (Promise unwrapped), so `const simnet = await initSimnet()` types `simnet` as `Simnet` — deprecated members are judged against the actual type instead of being suppressed when an identically-named non-deprecated member exists elsewhere (the proxy-over-raw-class pattern: clarinet's `runSnippet`). Deprecation notes also flow from `deprecationReason` fields, not just `@deprecated` tags.

## 1.7.0

### Minor Changes

- b5a9562: New prose drift type: `prose-deprecated-reference` (17 drift types total). Docs code blocks that import or call an API the spec marks deprecated are flagged — with the spec's deprecation note surfaced as the suggestion — unless the surrounding prose (±5 lines) already acknowledges the deprecation. Deterministic version of a finding class previously only agents caught (e.g. clarinet's `runSnippet` promoted while its types say `@deprecated use execute`). Registry now indexes deprecated exports/members; `MarkdownDocFile` carries raw content for prose-context checks.

## 1.6.0

### Minor Changes

- 0010eb0: Coverage accuracy + external docs corpus (posthog-js dogfood fixes):

  - Coverage no longer counts external re-exports as undocumented. Exports whose
    declaration lives outside the analyzed program (`source.file === '<external>'`
    or a package-only source) are excluded from the denominator in
    `buildDriftSpec`, `scan`, `coverage`, and `health`, and surfaced separately:
    `summary.externalExports` / `health.completeness.external` in the SDK,
    `coverage.external` in CLI JSON, and a "+N external (not resolvable here)"
    note in human output. New SDK exports: `isExternalExport`,
    `EXTERNAL_SOURCE_FILE`; `ApiSource` gains `package`/`version`.
  - New `--docs <patterns...>` flag on `scan` and `lint`: point prose drift at an
    arbitrary markdown corpus (glob patterns or directories, e.g. a hosted docs
    site pulled down locally) instead of the repo-local defaults. Runs for any
    language when given explicitly; warns when patterns match no files.

## 1.4.0

### Minor Changes

- 327ed34: Publish integrity + audit fixes. CLI: replace `workspace:*` internal dep ranges with real semver (1.3.0 was uninstallable via npm — the workspace protocol leaked into the published manifest), drop dead main/types/exports fields (bin-only package), correct `--help` claims. SDK: ship `schemas/` so `SCHEMA_URL` stops 404ing, remove orphaned scan/install modules, move type-only @vercel/sandbox out of runtime deps. All packages: `engines.node >=20`, `prepublishOnly` build guard; clarity adapter now ships LICENSE + README.

## 1.3.0

### Minor Changes

- Accept ApiSpec directly in buildDriftSpec and generateReport

## 1.2.0

### Minor Changes

- 52872dd: Define drift-spec: language-agnostic input types (ApiSpec, ApiExport, ApiTag, etc.) and migrate all drift analysis to use them. openpkg-ts becomes one adapter via toApiSpec() converter. Exports new types from `@driftdev/sdk/types` for external adapter authors.

### Patch Changes

- 52872dd: Fix pre-existing TypeScript compilation errors: sync DriftCategory prose variant, fix Zod type arg, add globSync declaration, install @types/mdast, remove duplicate DriftReport interface.

## 1.1.0

### Minor Changes

- dca86f4: Add `prose-unresolved-member` drift detection — validates method/property calls in doc code blocks against exported type members. Includes five-layer false positive filtering: known exports, external imports, package-derived objects, JS built-in methods, and type member lookup.

### Patch Changes

- dca86f4: Fall back to plain markdown parsing when MDX parser fails on non-MDX syntax (e.g. Gitbook `{% %}` directives).

## 1.0.2

### Patch Changes

- Fix dogfood gate: bundler duplicate export errors, prose drift false positives on subpath imports, stale README imports, add content/\*_/_.md to default discovery

## 1.0.1

### Patch Changes

- 8719ae0: Fix dogfood gate: bundler duplicate export errors, prose drift false positives on subpath imports, stale README imports, add content/\*_/_.md to default discovery

## 1.0.0

### Major Changes

- CLI: add formatWarning(), surface silent catches, next hints in human output, actionable entry detection errors, agent help epilog, workflow descriptions

  SDK: remove convenience re-exports from barrel (use subpath imports: @driftdev/sdk/analysis, /history, /cache, /markdown, /examples, /types)

## 0.42.0

### Minor Changes

- 2bf7604: Remove fix module and `fixable` field from all types. Add `Drift.scan()` facade. Add subpath exports (`/markdown`, `/examples`, `/history`, `/cache`). Bare `drift` always runs scan. Add `drift commands`.

## 0.41.0

### Minor Changes

- Consolidate @driftdev/spec into @driftdev/sdk. Spec types, constants, and JSON schema validation are now exported directly from the SDK. The @driftdev/spec package is removed.

## 0.39.0

### Patch Changes

- Improve release readiness and docs-quality workflows:

  - Expand CLI entry detection to support richer `package.json` layouts (`exports`, `module`, `bin`) and CLI-style source resolution.
  - Make `drift ci` skip packages with no detectable entry point instead of failing the entire run.
  - Align package metadata and docs links with the canonical repository.
  - Clarify SDK/docs guidance for API-surface regeneration and async return semantics.

## 0.36.0

### Minor Changes

- Add --project flag to drift init, delete dead TS config system, rewrite action.yml as drift ci wrapper, remove --ci from docs

### Patch Changes

- Updated dependencies
  - @driftdev/spec@0.36.0

## 0.35.1

### Patch Changes

- Retry publish under @driftdev scope (0.35.0 version was consumed by failed publish).
- Updated dependencies
  - @driftdev/spec@0.35.1

## 0.35.0

### Minor Changes

- Publish under @driftdev scope. Rename legacy config files from doccov.config._ to drift.config._, update CI/Action/docs references.

### Patch Changes

- Updated dependencies
  - @driftdev/spec@0.35.0

## 0.32.0

### Minor Changes

- 0b9d171: Improve param drift detection and schema extraction

## 0.31.1

### Patch Changes

- bump @openpkg-ts/extract 0.25.0 -> 0.27.0

## 0.31.0

### Minor Changes

- add batch analysis mode with glob patterns, cross-module link validation, incremental analysis, and improved drift detection

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.31.0

## 0.30.7

### Patch Changes

- perf: optimize drift detection - pre-compute fuzzy match candidates, combine example AST parsing, add early exits, skip expensive diagnostics

## 0.30.6

### Patch Changes

- fix: update @openpkg-ts/extract to 0.23.2 (adds deprecated flag extraction)

## 0.30.4

### Patch Changes

- fix(sdk): bump @openpkg-ts/extract to 0.23.1 for correct isExternal detection on linked packages

## 0.30.3

### Patch Changes

- bump @openpkg-ts/extract ^0.19.0 -> ^0.23.0, @openpkg-ts/spec -> ^0.23.0

## 0.30.1

### Patch Changes

- refactor(sdk): use SpecTag.param for param parsing, bump openpkg-ts deps

  - utils.ts: rewrite extractParamFromTag to use SpecTag.param field directly
  - param-drift.ts: pass full SpecTag to extractParamFromTag
  - index.ts: remove normalizeParamName export (unused)
  - cli/writer.ts: use findProjectRoot for cleaner relative paths
  - bump @openpkg-ts/extract ^0.18.0 -> ^0.19.0 (root, sdk)
  - bump @openpkg-ts/spec ^0.12.0 -> ^0.19.0 (sdk, cli, web)

## 0.30.0

### Minor Changes

- feat(sdk): add project root detection for monorepo .doccov dir placement

  - Add `findProjectRoot()` and `getDoccovDir()` utils to SDK
  - Walk up from cwd to find .git, pnpm-workspace, or workspaces field
  - Ensures .doccov/ is always at repo root, not inside subpackages
  - CLI uses SDK's getDoccovDir for cache, history, spec, and reports

## 0.29.4

### Patch Changes

- fix(cli): suppress noisy external type diagnostics from check output

  - Add `code` field to `Diagnostic`, `SpecDiagnostic`, and `CachedDiagnostic` interfaces
  - Preserve diagnostic codes from @openpkg-ts/extract through SDK pipeline
  - Filter out `EXTERNAL_TYPE_*` info diagnostics in CLI check command
  - Bump cache version to 1.3.0

## 0.29.2

### Patch Changes

- refactor: use @openpkg-ts/extract for program creation, cache diagnostics/forgotten exports

  - Replace local `analysis/program.ts` with `@openpkg-ts/extract` createProgram
  - Rename `openpkg.ts` -> `analyzer.ts` for clarity
  - Cache specDiagnostics and forgottenExports for faster cache hits
  - Bump cache version to 1.2.0
  - Default cwd to git repo root instead of process.cwd()

## 0.29.0

### Patch Changes

- feat(badge): use doccov.json report instead of openpkg.json

  Badge endpoints now read health score from `.doccov/doccov.json` instead of computing from `openpkg.json`. Added remote docs fetching to CLI (URL, GitHub patterns) with caching support. Moved spec cache to `.doccov/cache/` subdirectory.

## 0.28.3

### Patch Changes

- fix(typecheck): skip auto-import when example already imports from package

## 0.28.2

### Patch Changes

- fix(cli): fail check on runtime errors; fix(sdk): compute drift ratio from total exports

## 0.28.1

### Patch Changes

- 24f04ff: style: sort imports alphabetically, remove unused import

## 0.28.0

### Minor Changes

- refactor: major cleanup - move platform packages, simplify CLI

  ## Package Restructure

  - Moved `api-shared`, `auth`, `db`, `sandbox`, `ui` from `packages/` to `apps/platform/`
  - These are now internal platform code, not publishable packages

  ## CLI Removals

  - Removed `info` command
  - Removed deprecated flags: `--min-coverage`, `--max-drift`, `--min-api-surface`, `--update-snapshot`
  - Removed output formats: `html`, `github`, `pr-comment`, `changelog`
  - Removed report renderers: changelog-renderer, github, html, pr-comment

  ## SDK Changes

  - Removed `RetentionTier` type and `pruneByTier` function (simplified to single 90-day retention)
  - Removed deprecated `minCoverage`, `maxDrift`, `minApiSurface` from `CheckConfig` type
  - Moved config schema from CLI to SDK (`docCovConfigSchema`, `normalizeConfig`)
  - Exported `DocCovConfigInput` type for config validation

  ## Type System

  - Renamed `NormalizedDocCovConfig` to `DocCovConfig`
  - Config validation schema still accepts deprecated fields for backwards compat

  ## Breaking Changes

  - Consumers using removed CLI commands/flags need to migrate
  - Consumers using tier-based retention need to use simple `pruneHistory()`

## 0.27.5

### Patch Changes

- chore: bump for @openpkg-ts/extract JS support
- Updated dependencies
  - @openpkg-ts/extract@0.18.0

## 0.27.4

### Patch Changes

- Updated dependencies
  - @openpkg-ts/extract@0.17.0

## 0.27.3

### Patch Changes

- refactor(sdk): replace local schema adapters with @openpkg-ts/extract re-exports

## 0.27.2

### Patch Changes

- fix(extract): strip TSDoc hyphen separator from @param/@typeParam descriptions
  feat(sdk): add @throws tag support to JSDoc writer
- Updated dependencies
  - @openpkg-ts/extract@0.16.1

## 0.27.0

### Minor Changes

- Add unified documentation health score combining completeness + accuracy metrics

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.27.0

## 0.26.0

### Minor Changes

- Add API surface completeness analysis for forgotten exports detection

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.26.0
  - @openpkg-ts/extract@0.16.0

## 0.25.12

### Patch Changes

- Updated dependencies
  - @openpkg-ts/extract@0.15.0

## 0.25.11

### Patch Changes

- fix(drift): skip property access names in identifier reference check

## 0.25.10

### Patch Changes

- feat(extract): serialize namespace members into spec output
  feat(sdk): include namespace members in drift export registry
- Updated dependencies
  - @openpkg-ts/extract@0.14.5

## 0.25.9

### Patch Changes

- refactor: extract shared CLI utilities to cli-utils package

  - Move progress, spinner, and output formatting utilities to new cli-utils package
  - Update CLI commands to use shared cli-utils (colors, symbols, summary component)
  - Update extract CLI to use shared cli-utils
  - Remove deprecated progress.ts from CLI
  - Remove outdated doc-generator examples
  - Update package READMEs

- Updated dependencies
  - @openpkg-ts/extract@0.14.3

## 0.25.8

### Patch Changes

- fix(extract): correct package.json exports path (dist/index.js -> dist/src/index.js)
- Updated dependencies
  - @openpkg-ts/extract@0.14.2

## 0.25.7

### Patch Changes

- Bump extract dependency
- Updated dependencies
  - @openpkg-ts/extract@0.14.1

## 0.25.5

### Patch Changes

- Consolidate type extraction logic into @openpkg-ts/extract package. Removes duplicate serializers from SDK, adds rich type schema extraction with class/interface members and generics support.
- Updated dependencies
  - @openpkg-ts/extract@0.14.0

## 0.25.4

### Patch Changes

- Updated dependencies
  - @openpkg-ts/extract@0.13.0

## 0.25.3

### Patch Changes

- fix(sdk): handle generic type references with typeArguments in formatTypeReference

  - Support $ref + typeArguments for user-defined generic types
  - Expand builtin generics (Promise, Map, Set, etc.) with proper typeArguments
  - Add tests for generic type formatting

- Updated dependencies
  - @openpkg-ts/extract@0.12.0
  - @openpkg-ts/spec@0.12.0

## 0.25.2

### Patch Changes

- chore: bump @openpkg-ts/extract dependency
- Updated dependencies
  - @openpkg-ts/extract@0.11.4

## 0.25.1

### Patch Changes

- fix: replace workspace:\* with hardcoded versions for npm compatibility
- Updated dependencies
  - @openpkg-ts/extract@0.11.3

## 0.25.0

### Minor Changes

- Remove unused enrichment/diff code from SDK, delete unused UI components (drift-command-center, fix-workflow, pr-coverage)

## 0.24.2

### Patch Changes

- Updated dependencies
  - @openpkg-ts/extract@0.11.2

## 0.24.1

### Patch Changes

- Initial release of @openpkg-ts/doc-generator

  - Core API: createDocs(), loadSpec() for loading OpenPkg specs
  - Query utilities: formatSchema(), buildSignatureString(), member filtering and sorting
  - Renderers: Markdown/MDX, HTML, JSON output formats
  - Navigation: Fumadocs, Docusaurus, and generic nav generation
  - Search: Pagefind and Algolia compatible indexes
  - React components: Headless (unstyled) and styled (Tailwind v4) variants
  - CLI: generate, build, dev commands
  - Adapter architecture: Extensible framework integration pattern

- Updated dependencies
  - @openpkg-ts/extract@0.11.1
  - @openpkg-ts/spec@0.11.1
  - @doccov/spec@0.24.1

## 0.24.0

### Minor Changes

- Consolidate drift types in SDK, simplify spec package, add source extraction to spec command

### Patch Changes

- Updated dependencies
  - @doccov/spec@0.24.0

## 0.23.0

### Minor Changes

- refactor: modularize api into shared packages with centralized middleware

## 0.22.1

### Patch Changes

- refactor: split api into modular packages (api-shared, auth), move migrations to db

## 0.22.0

### Minor Changes

- Remove deprecated `tsType` field in favor of `schema`, add CLI warning when `--runtime` requested without built code

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.11.0

## 0.21.0

### Minor Changes

- feat: runtime TypeBox schema extraction - detect TypeBox schemas via Kind symbol and use directly as JSON Schema, preserving formats/constraints

## 0.20.0

### Minor Changes

- feat: runtime Standard Schema detection for Zod, Valibot, TypeBox, ArkType

## 0.19.0

### Minor Changes

- feat: hybrid schema extraction for Zod, Valibot, TypeBox, ArkType

  - Static extraction via TypeScript Compiler API (default, no runtime)
  - Runtime extraction via Standard Schema spec (opt-in, richer output)
  - New `--runtime` CLI flag enables hybrid mode
  - Falls back gracefully from runtime to static extraction

## 0.18.0

### Minor Changes

- Enhanced quality rules, filtering, github context, analysis reports, new API routes (ai, billing, demo, github-app, invites, orgs), trends command, diff capabilities

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.10.0

## 0.15.1

### Patch Changes

- Consolidate duplicate FIXABLE_DRIFT_TYPES into single isFixableDrift() source

## 0.15.0

### Minor Changes

- Add SDK test suite with 113 tests, refactor parameter-utils.ts into focused modules (typebox-handler, schema-builder, type-formatter), remove deprecated aliases (OpenPkg, OpenPkgOptions)

## 0.13.0

### Minor Changes

- e063639: refactor: replace scan architecture with plan/execute model

  **@doccov/sdk**

  - Add `fetchGitHubContext()` for fetching repository metadata via GitHub API
  - Add `BuildPlan` types for describing build/analysis execution plans
  - Export new scan types: `BuildPlan`, `BuildPlanStep`, `BuildPlanExecutionResult`, `GitHubProjectContext`
  - Remove legacy scan orchestrator in favor of external execution

  **@doccov/cli**

  - Remove `scan` command (moved to API service)
  - Update `spec` command with improved analysis

  **@openpkg-ts/spec**

  - Add `BuildPlan` and related types to schema
  - Extend spec schema for plan-based analysis

### Patch Changes

- Updated dependencies [e063639]
  - @openpkg-ts/spec@0.9.0

## 0.12.0

### Minor Changes

- ### `diff` command improvements

  **New features:**

  - Hash-based report caching - repeated diffs with same specs are instant
  - `--no-cache` flag to bypass cache and force regeneration
  - `--strict` presets (`ci`, `release`, `quality`) for streamlined CI configuration
  - Support for both positional and explicit `--base`/`--head` arguments
  - `--min-coverage` and `--max-drift` threshold flags (same as `check` command)
  - Config file support for thresholds via `doccov.config.ts`
  - Simplified terminal output with detailed reports written to `.doccov/`

  **SDK additions:**

  - `calculateAggregateCoverage(spec)` - lightweight coverage calculation from exports
  - `ensureSpecCoverage(spec)` - ensures spec has top-level coverage score
  - `getDiffReportPath()` - hash-based diff report path generation

  **Fixes:**

  - Coverage now correctly calculated for raw specs (was showing 0% → 0%)
  - Shared validation utilities extracted to avoid duplication between `check` and `diff`

## 0.11.0

### Minor Changes

- Version sync release

## 0.10.1

### Patch Changes

- Fix path duplication bug in monorepo entry point detection

  When using `--package` flag in a monorepo, the entry point path was being duplicated
  (e.g., `packages/sdk/packages/sdk/src/index.ts` instead of `packages/sdk/src/index.ts`).

  The `detectEntryPoint` function now correctly returns paths relative to the package
  directory rather than including the package path prefix.

## 0.10.0

### Minor Changes

- ### @openpkg-ts/spec

  **Breaking (pre-1.0):** Restructured spec types to move coverage metadata to an enrichment layer:

  - Removed `docs` field from `SpecExport` and `OpenPkg` types (now provided via SDK enrichment)
  - Changed `SpecDocsMetadata.missing` from `SpecDocSignal[]` to `string[]` (now uses rule IDs)
  - Added `DriftType` as a standalone exported type
  - Added `DriftCategory` type with three categories: `structural`, `semantic`, `example`
  - Added `DRIFT_CATEGORIES` mapping, `DRIFT_CATEGORY_LABELS`, and `DRIFT_CATEGORY_DESCRIPTIONS` constants for categorizing and displaying drift issues

  ### @doccov/sdk

  **Breaking (pre-1.0):** Replaced the lint module with a new quality rules engine and added spec-level caching:

  - Removed the `lint` module (`LintConfig`, `LintRule`, `lintExport`, `lintExports`, etc.)
  - Added `quality` module with a flexible rules-based engine:
    - `QualityRule`, `QualityViolation`, `QualityConfig` types
    - `evaluateQuality()`, `evaluateExportQuality()` functions
    - Built-in rules: `CORE_RULES`, `STYLE_RULES`, `BUILTIN_RULES`
  - Added `cache` module for spec-level caching:
    - `loadSpecCache()`, `saveSpecCache()`, `validateSpecCache()`
    - `hashFile()`, `hashFiles()`, `hashString()` utilities
  - Added enrichment layer:
    - `enrichSpec()` function
    - `EnrichedExport`, `EnrichedOpenPkg`, `EnrichedDocsMetadata` types
  - Added unified report generation:
    - `generateReport()`, `generateReportFromEnriched()`
    - `DocCovReport`, `CoverageSummary`, `DriftReport` types
  - Added unified example validation:
    - `validateExamples()` function
    - `parseExamplesFlag()`, `shouldValidate()` utilities
    - `ExampleValidationResult`, `ExampleValidationOptions` types

  ### @doccov/cli

  **Breaking (pre-1.0):** Revamped commands for better UX and added multi-format reporting:

  - Renamed `generate` command to `spec` (generates OpenPkg spec files)
  - Added `info` command for quick package summary (exports, coverage, drift at a glance)
  - Revamped `check` command:
    - Removed options: `--require-examples`, `--exec`, `--no-lint`, `--no-typecheck`, `--ignore-drift`
    - Added options: `--examples [mode]` (presence, typecheck, run), `--max-drift <percentage>`, `--format <format>`, `-o/--output <file>`, `--stdout`, `--no-cache`
    - Now supports multi-format output: text, json, markdown, html, github
    - Writes reports to `.doccov/` directory by default
  - Added spec-level caching (use `--no-cache` to bypass)
  - Simplified config schema to match new quality rules engine

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.8.0

## 0.9.0

### Minor Changes

- feat: sdk enhancments

  - Parse @see JSDoc tags and extract see-also relations
  - Extract structured example metadata (title, description, language) from @example blocks
  - Emit related field on classes (extends/implements), functions (returns), and interfaces (extends)
  - Update TypeReference to use SpecSchema type from spec package
  - Fix deterministic-fixes and jsdoc-writer to handle SpecExample objects

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.7.0

## 0.8.0

### Minor Changes

- add extraction features:

  - **@throws parsing**: Parse and structure @throws/@throw/@exception JSDoc tags
  - **Decorator extraction**: Extract decorators from classes, members, and parameters
  - **Module augmentation detection**: Detect and mark `declare module "..."` augmentations
  - **Conditional/mapped type analysis**: Extract structural information from conditional and mapped types

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.6.0

## 0.7.0

### Minor Changes

- fixed serialization of overloaded methods in classes and interfaces and enhanced jsdoc tag parsing to extract structured fields

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.5.0

## 0.6.0

### Minor Changes

- extract tsdoc parser, builtin detection, and ast extractor utilities

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.4.1

## 0.5.9

### Patch Changes

- feat: support typebox types

## 0.5.8

### Patch Changes

- feat: add lint and typechecking commands

## 0.5.7

### Patch Changes

- return all undocumented exports (not just new) in docs impact analysis
- Updated dependencies
  - @openpkg-ts/spec@0.4.0

## 0.5.6

### Patch Changes

- add member-level docs impact detection for classes - detects method additions, removals, and signature changes with smart replacement suggestions

## 0.3.7

### Patch Changes

- fix: cleanup internal/private type warnings

## 0.3.6

### Patch Changes

- fix duplicate null in schema

## 0.3.5

### Patch Changes

- fix interface member serialization with jsdocs

## 0.3.4

### Patch Changes

- fix computed type property resolution for TypeBox, Zod, and similar patterns where valueDeclaration is undefined

## 0.3.3

### Patch Changes

- feat(cli): add markdown docs impact detection to diff command
  refactor(cli): consolidate fix functionality into check command
  refactor(sdk): reuse detection extraction
  fix(api): bug in api scan
  fix(api): monorepo detection in scan
  fix(api): improve scan-stream reliability and ref support

## 0.3.0

### Minor Changes

- ## OpenPkg Spec Builder Improvements

  ### New Features

  - **Class inheritance**: Capture `extends` and `implements` clauses
  - **Namespace exports**: Support `export namespace X { ... }`
  - **Function overloads**: Capture all overload signatures
  - **Mapped/conditional types**: Preserve `tsType` for complex types
  - **External types**: Graceful handling with `kind: "external"` stubs
  - **Interface methods**: Serialize method signatures on interfaces
  - **Index signatures**: Capture `[key: string]: T` patterns
  - **Default values**: Preserve parameter defaults
  - **Rest parameters**: Mark with `rest: true`
  - **Getter/setter pairs**: Merge into single member
  - **Call/construct signatures**: Capture callable interfaces
  - **Type predicates**: Preserve `x is string` and `asserts x` returns
  - **Union discriminants**: Add `discriminator: { propertyName }` for tagged unions
  - **Re-export aliasing**: Correctly track `export { X as Y }`

  ### CLI Changes

  - Renamed `--no-external-types` to `--skip-resolve` across all commands
  - Added `--skip-resolve` to `report` and `scan` commands
  - New warnings for unresolved external types
  - Info message when `node_modules` not found

  ### Bug Fixes

  - Fixed circular type reference detection
  - Fixed destructured parameter TSDoc matching
  - Fixed drift detection for destructured params

### Patch Changes

- Updated dependencies
  - @openpkg-ts/spec@0.3.0

## 0.2.2

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.2

## 0.2.1

### Patch Changes

- c74cf99: initial release of spec, sdk, and cli packages
- Updated dependencies [c74cf99]
  - @openpkg-ts/spec@0.2.1
