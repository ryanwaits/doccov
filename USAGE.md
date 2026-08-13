# Usage Guide

Detect when your docs drift from your code — TypeScript packages, OpenAPI specs, Clarity contracts.

## Quick Start

1. Install:
```bash
bun add -g @driftdev/cli
```

2. Run a full scan:
```bash
drift scan                          # TypeScript package
drift scan --spec openapi.json      # REST API (path or URL)
```

3. Check documentation coverage:
```bash
drift coverage --min 80
```

## CLI Commands

### `drift scan`

Coverage + lint + prose drift + health in one pass. Default command — bare `drift` runs this.

```bash
drift scan [entry] [options]
```

Options:
- `--min <n>` — Minimum health threshold (exit 1 if below)
- `--all` — Run across all workspace packages
- `--private` — Include private packages
- `--lang <language>` — Source language: inferred from `--spec`/`--abi`/`.clar`; default `typescript`
- `--abi <path>` — ABI JSON file (required for Clarity)
- `--spec <path>` — OpenAPI 3.x JSON document — path or URL (implies openapi)
- `--docs <patterns...>` — Markdown corpus for prose drift: globs or directories (e.g. a hosted docs site pulled down locally); overrides repo-local defaults

### `drift health`

Documentation health score.

```bash
drift health [entry] [options]
```

Options:
- `--min <n>` — Minimum health threshold
- `--all` — Run across all workspace packages
- `--private` — Include private packages
- `--lang/--abi/--spec` — Truth source: Clarity (`--abi` + `.clar`) or OpenAPI (`--spec` path/URL); inferred

### `drift coverage`

Documentation coverage score.

```bash
drift coverage [entry] [options]
```

Options:
- `--min <n>` — Minimum coverage % (exit 1 if below)
- `--all` — Run across all workspace packages
- `--private` — Include private packages
- `--lang/--abi/--spec` — Truth source: Clarity (`--abi` + `.clar`) or OpenAPI (`--spec` path/URL); inferred

### `drift lint`

Cross-reference JSDoc vs code signatures. Detects 17 drift types including prose drift (broken imports, unresolved member references, and un-noted deprecated API references in markdown).

```bash
drift lint [entry] [options]
```

Options:
- `--all` — Run across all workspace packages
- `--private` — Include private packages
- `--lang/--abi/--spec` — Truth source: Clarity (`--abi` + `.clar`) or OpenAPI (`--spec` path/URL); inferred
- `--docs <patterns...>` — Markdown corpus for prose drift: globs or directories; overrides repo-local defaults

```bash
# Audit an external docs corpus (e.g. hosted docs pulled down) against the API
drift lint src/index.ts --docs ../docs-site/content
```

### `drift examples`

Validate @example blocks.

```bash
drift examples [entry] [options]
```

Options:
- `--typecheck` — Type-check examples
- `--run` — Execute examples that contain `// =>` assertions (installs the package; lifecycle scripts disabled)
- `--yes` — Confirm `--run` (required when not a TTY; or set `examples.run` in config)
- `--untrusted` — Treat the target as a third-party package (OS isolation; macOS only)
- `--min <n>` — Minimum example coverage %
- `--all` — Run across all workspace packages
- `--private` — Include private packages

### `drift extract`

Extract full API spec as JSON.

```bash
drift extract [entry] [options]
```

Options:
- `-o <file>` — Write to file
- `--only <patterns>` — Include exports matching glob
- `--ignore <patterns>` — Exclude exports matching glob
- `--max-depth <n>` — Max type resolution depth (default: 10)
- `--all` — Extract all workspace packages
- `--private` — Include private packages
- `--lang/--abi/--spec` — Truth source: Clarity (`--abi` + `.clar`) or OpenAPI (`--spec` path/URL); inferred

### `drift list`

List all exports with kinds. Positional arg is a search term or entry file path.

```bash
drift list [searchOrEntry] [options]
```

Options:
- `--kind <type>` — Filter by export kind
- `--undocumented` — Show only undocumented exports
- `--drifted` — Show only exports with drift issues
- `--full` — Show full details
- `--all` — Run across all workspace packages
- `--lang/--abi/--spec` — Truth source: Clarity (`--abi` + `.clar`) or OpenAPI (`--spec` path/URL); inferred

### `drift get`

Get single export detail + types. Entry auto-detected; pass it first to override.

```bash
drift get <name>
drift get <entry> <name>
drift get candidateInfo --spec https://example.com/openapi.json
```

Options:
- `--lang/--abi/--spec` — Truth source: Clarity (`--abi` + `.clar`) or OpenAPI (`--spec` path/URL); inferred

Includes fuzzy matching — suggests similar names if not found.

### `drift diff`

What changed between two specs.

```bash
drift diff <old> <new>
drift diff --base main --head HEAD
```

Options:
- `--base <ref>` — Git ref for old spec
- `--head <ref>` — Git ref for new spec
- `--entry <file>` — Entry file for git ref extraction
- `--all` — Run across all workspace packages
- `--private` — Include private packages

### `drift breaking`

Detect breaking changes (exit 1 if found).

```bash
drift breaking <old> <new>
drift breaking --base main --head HEAD
```

Options:
- `--base <ref>` — Git ref for old spec
- `--head <ref>` — Git ref for new spec
- `--entry <file>` — Entry file for git ref extraction
- `--all` — Run across all workspace packages
- `--private` — Include private packages

### `drift semver`

Recommend semver bump based on changes.

```bash
drift semver <old> <new>
```

Options:
- `--base <ref>` — Git ref for old spec
- `--head <ref>` — Git ref for new spec
- `--entry <file>` — Entry file for git ref extraction

### `drift changelog`

Generate changelog from spec diff.

```bash
drift changelog <old> <new> [options]
```

Options:
- `--format <md|json>` — Output format (default: md)
- `--base <ref>` — Git ref for old spec
- `--head <ref>` — Git ref for new spec
- `--entry <file>` — Entry file for git ref extraction

### `drift ci`

CI checks with GitHub integration.

```bash
drift ci [options]
```

Options:
- `--all` — Check all packages, not just changed
- `--private` — Include private packages
- `--min <n>` — Minimum coverage threshold

Features:
- Auto-detects changed packages via `git diff`
- Posts PR comments with results
- Writes GitHub step summaries
- Appends to history for trend tracking
- Generates `.drift/context.md`

### `drift release`

Pre-publish documentation audit. Checks coverage + lint against thresholds.

```bash
drift release [entry]
```

Exit 1 if not ready. Suggests next command to fix issues.

### `drift report`

Documentation trends from history.

```bash
drift report [options]
```

Options:
- `--all` — Show all packages

Shows coverage/lint trends over time and packages needing attention. Auto-seeds history on first run.

### `drift context`

Generate agent-readable project state as markdown.

```bash
drift context [entry] [options]
```

Options:
- `--all` — Include all workspace packages
- `--private` — Include private packages
- `--output <path>` — Output path (default: `~/.drift/projects/<slug>/context.md`)

### `drift config`

Manage configuration.

```bash
drift config list                        # show all values
drift config get <key>                   # get by dot-notation key
drift config set <key> <value>           # set globally
drift config set <key> <value> --project # set in drift.config.json
```

### `drift init`

Create configuration file.

```bash
drift init
drift init --project  # local drift.config.json
```

### `drift validate`

Validate a spec file.

```bash
drift validate <spec.json>
```

### `drift filter`

Filter exports in a spec file.

```bash
drift filter <spec.json> [options]
```

Options:
- `--kind <type>` — Filter by kind
- `--search <term>` — Search by name
- `--tag <tag>` — Filter by tag
- `--deprecated` / `--no-deprecated` — Only/exclude deprecated exports

### `drift cache`

Cache management.

```bash
drift cache status   # show cache stats
drift cache clear    # clear cache
```

### `drift mcp`

Stdio MCP server exposing drift tools (`drift_extract/list/get/scan/diff/breaking`) to any agent.

```bash
claude mcp add drift -- drift mcp
```

### Agent Discovery

```bash
drift --tools    # JSON list of all commands + flags
```

## Configuration

### drift.config.json

```json
{
  "entry": "src/index.ts",
  "coverage": {
    "min": 80,
    "ratchet": true
  },
  "lint": true,
  "docs": {
    "include": ["README.md", "docs/**/*.md"],
    "exclude": ["node_modules/**"]
  }
}
```

Config resolution order: flag → project → parent → global → built-ins.

## Understanding the Output

All commands return `{ok, data, meta}` JSON when piped or with `--json`:

```json
{
  "ok": true,
  "data": {
    "coverage": { "score": 88, "documented": 243, "total": 275, "undocumented": 32 },
    "lint": { "issues": [], "count": 36 },
    "health": 89,
    "pass": true
  },
  "meta": { "command": "scan", "duration": 7845, "version": "1.4.0" }
}
```

### Drift Issues

Each lint issue includes enough context for agents to fix:

```json
{
  "export": "createUser",
  "issue": "JSDoc documents parameter 'userId' which is not present in the signature.",
  "location": "userId",
  "filePath": "docs/api.md",
  "line": 42
}
```

## SDK Usage

### Basic Analysis

```typescript
import { Drift } from '@driftdev/sdk';

const drift = new Drift();
const result = await drift.analyzeFileWithDiagnostics('src/index.ts');

console.log(`Package: ${result.spec.meta.name}`);
console.log(`Exports: ${result.spec.exports.length}`);
```

### Drift Detection

```typescript
import { computeDrift, buildExportRegistry, detectProseDrift, discoverMarkdownFiles } from '@driftdev/sdk';

// JSDoc drift
const drift = computeDrift(spec);
for (const [name, issues] of drift.exports) {
  for (const d of issues) {
    console.log(`${name}: ${d.issue}`);
  }
}

// Prose drift (broken markdown references)
const registry = buildExportRegistry(spec);
const mdFiles = discoverMarkdownFiles(process.cwd());
const proseIssues = detectProseDrift({ packageName: '@my/pkg', markdownFiles: mdFiles, registry });
```

### Spec Validation

```typescript
import { normalize, validateSpec, diffSpec } from '@openpkg-ts/spec';

const normalized = normalize(spec);
const result = validateSpec(normalized);

const diff = diffSpec(oldSpec, newSpec);
console.log('Breaking changes:', diff.breaking);
```

## CI Integration

### GitHub Actions

```yaml
- uses: ryanwaits/drift/action@v1
  with:
    min-coverage: 80
```

### Direct

```bash
drift scan --min 80
```
