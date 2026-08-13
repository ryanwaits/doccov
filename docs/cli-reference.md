# CLI Reference

Binary: `drift`. Package: `@driftdev/cli`.

All commands output human-readable text in a TTY, JSON envelopes when piped. Override with `--json` or `--human`.

## Who This Is For

- Engineers integrating Drift into CI or internal tooling.
- Maintainers who need exact flags, exits, and JSON shapes.
- Agent workflows that require stable machine-readable command contracts.

## Why Use This Page

- To look up exact command/flag behavior quickly.
- To verify JSON response fields before scripting.
- To understand exit-code behavior for CI gates.

## How To Use It

1. Start with [Getting Started](./getting-started.md) for first-run setup.
2. Use this page as the detailed reference once Drift is already installed.
3. Use `drift --tools` when you need machine-readable command discovery.

## Global Flags

| Flag | Type | Description |
|------|------|-------------|
| `--json` | boolean | Force JSON output (default when piped) |
| `--human` | boolean | Force human-readable output (default in TTY) |
| `--config <path>` | string | Path to drift config file |
| `--cwd <dir>` | string | Run as if started in `<dir>` |
| `--no-cache` | boolean | Bypass spec cache |
| `--tools` | boolean | Print machine-readable command/flag manifest and exit |

## JSON Output Envelope

Every command wraps its output in this shape:

```json
{
  "ok": true,
  "data": { ... },
  "meta": {
    "command": "scan",
    "duration": 342,
    "version": "1.4.0"
  },
  "next": {
    "suggested": "drift-fix skill",
    "reason": "2 of 3 issues are auto-fixable"
  }
}
```

Error shape:

```json
{
  "ok": false,
  "error": "Entry file not found",
  "meta": { "command": "scan", "duration": 12, "version": "1.4.0" }
}
```

## Exit Codes

Grep convention, so CI and agents can branch without parsing:

| Code | Meaning |
|------|---------|
| `0` | Clean — no findings, thresholds met |
| `1` | Findings — drift issues, threshold missed, or lookup not found |
| `2` | Error — bad usage or internal failure |

## Reproducible Output

Set `SOURCE_DATE_EPOCH` (seconds since epoch) to make JSON output byte-stable across runs: `meta.duration` reports `0` and spec/report `generatedAt` derives from the epoch instead of the wall clock. Use when diffing or caching `drift extract` output in CI.

---

## Composed Commands

### `drift scan [entry]`

Coverage + lint + prose drift + health in one pass. This is the **default command** -- bare `drift` runs this.

| Flag | Type | Description |
|------|------|-------------|
| `--min <n>` | number | Minimum health threshold (exit 1 if below) |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--lang <language>` | string | Source language: inferred from `--spec`/`--abi`/`.clar`; default `typescript` |
| `--abi <path>` | string | ABI JSON file (required for Clarity) |
| `--spec <path>` | string | OpenAPI 3.x JSON document — path or URL (implies openapi) |
| `--docs <patterns...>` | string[] | Markdown corpus for prose drift (overrides repo-local defaults) |
| `--docs-map <file>` | string | Docs map (page→type) activating key-coverage mode |
| `--annotations` | boolean | Emit GitHub Actions `::error`/`::warning` annotations for findings |

```bash
drift            # bare drift = scan
drift scan src/index.ts --min 80
drift scan --all --private
drift scan --lang clarity --abi token.abi.json token.clar
drift scan --lang openapi --spec openapi.json
drift scan --docs-map drift.docs-map.json --annotations
```

`--lang clarity` and `--lang openapi` run in single-package mode only (`--all` is TypeScript-only). Prose drift is TypeScript-only for now.

Data shape:

```json
{
  "coverage": { "score": 88, "documented": 22, "total": 25, "undocumented": 3 },
  "lint": {
    "issues": [
      { "export": "parseConfig", "issue": "@param 'options' type mismatch", "filePath": "src/config.ts", "line": 42 }
    ],
    "count": 1
  },
  "health": 85,
  "pass": true,
  "packageName": "my-lib",
  "packageVersion": "1.0.0"
}
```

### Key-coverage mode (`--docs-map`)

A docs map (`drift.docs-map.json`, JSON Schema at `@driftdev/cli/schemas/drift.docs-map.schema.json`) maps docs pages to spec types. Scan then diffs each page's documented option keys (backticked table cells inside option sections) against the type's real properties:

- **gap** — a type key the page doesn't document (classified user-facing/internal/deprecated)
- **ghost** — a documented key that exists on no spec type → **FAIL**
- **inversion** — a documented deprecated key whose replacement isn't documented (replacement auto-derived from `@deprecated Use X instead`) → WARN
- gaps above the committed `baselineGaps` ratchet → **FAIL** (drift shrinks, never grows)

```json
{
  "$schema": "https://unpkg.com/@driftdev/cli/schemas/drift.docs-map.schema.json",
  "version": 1,
  "pages": [
    {
      "page": "contents/docs/node/index.mdx",
      "extraPages": ["contents/docs/node/_snippets/*.mdx"],
      "type": "PostHogOptions",
      "spec": "specs/node.json",
      "baselineGaps": 37
    }
  ]
}
```

The scan envelope gains `data.docsCoverage.pages[]` with per-page counts, `gaps`, `ghosts`, `inversions`, and `status`. Bootstrap the map with `drift docs-map stub` (see below) or the `drift-docs-map` skill.

### `drift docs-map stub|baseline`

| Subcommand | Description |
|------------|-------------|
| `stub --docs <patterns...> [--out <file>]` | Scaffold a map: pages with option tables, types ranked by key overlap |
| `baseline <map>` | Tighten each page's `baselineGaps` to current counts (ratchet — never raises) |

Batch mode (`--all`) data shape:

```json
{
  "packages": [
    { "name": "@scope/core", "exports": 45, "coverage": 92, "lintIssues": 2, "health": 88 },
    { "name": "@scope/utils", "exports": 12, "coverage": 75, "lintIssues": 0, "health": 88 }
  ],
  "skipped": ["@scope/internal"]
}
```

### `drift health [entry]`

Documentation health score.

| Flag | Type | Description |
|------|------|-------------|
| `--min <n>` | number | Minimum health threshold (exit 1 if below) |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--lang <language>` | string | Source language: inferred from `--spec`/`--abi`/`.clar`; default `typescript` |
| `--abi <path>` | string | ABI JSON file (required for Clarity) |
| `--spec <path>` | string | OpenAPI 3.x JSON document — path or URL (implies openapi) |

```bash
drift health
drift health --min 80
drift health --all
```

Data shape:

```json
{
  "health": 85,
  "completeness": 88,
  "accuracy": 82,
  "totalExports": 25,
  "documented": 22,
  "undocumented": 3,
  "drifted": 2,
  "issues": [
    { "export": "createClient", "issue": "@returns type mismatch" }
  ],
  "packageName": "my-lib",
  "packageVersion": "1.0.0",
  "min": 80
}
```

### `drift ci`

CI checks on changed packages with GitHub integration.

| Flag | Type | Description |
|------|------|-------------|
| `--all` | boolean | Check all packages (not just changed) |
| `--private` | boolean | Include private packages |
| `--min <n>` | number | Minimum coverage percentage (0-100) |

```bash
drift ci
drift ci --all
```

Data shape:

```json
{
  "results": [
    {
      "name": "@scope/core",
      "coverage": 92,
      "coveragePass": true,
      "lintIssues": 0,
      "lintPass": true,
      "exports": 45,
      "pass": true
    }
  ],
  "pass": true,
  "min": 80,
  "skipped": ["@scope/internal"]
}
```

See [CI Integration](./ci-integration.md) for GitHub Actions setup.

---

## Analysis Commands

### `drift coverage [entry]`

Documentation coverage score.

| Flag | Type | Description |
|------|------|-------------|
| `--min <n>` | number | Minimum coverage threshold (exit 1 if below) |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--lang <language>` | string | Source language: inferred from `--spec`/`--abi`/`.clar`; default `typescript` |
| `--abi <path>` | string | ABI JSON file (required for Clarity) |
| `--spec <path>` | string | OpenAPI 3.x JSON document — path or URL (implies openapi) |

```bash
drift coverage
drift coverage --min 80
drift coverage --all
```

Data shape:

```json
{
  "score": 88,
  "documented": 22,
  "total": 25,
  "undocumented": ["parseConfig", "formatOutput", "validateInput"]
}
```

### `drift lint [entry]`

Cross-reference JSDoc against code for accuracy issues.

| Flag | Type | Description |
|------|------|-------------|
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--lang <language>` | string | Source language: inferred from `--spec`/`--abi`/`.clar`; default `typescript` |
| `--abi <path>` | string | ABI JSON file (required for Clarity) |
| `--spec <path>` | string | OpenAPI 3.x JSON document — path or URL (implies openapi) |
| `--annotations` | boolean | Emit GitHub Actions `::error file=…,line=…` annotations for findings |

```bash
drift lint
drift lint src/index.ts
drift lint --all
drift lint --annotations   # inline PR annotations in GitHub Actions
```

Data shape:

```json
{
  "issues": [
    {
      "export": "parseConfig",
      "issue": "@param 'options' type mismatch: documented as 'object', actual 'ParseOptions'",
      "location": "options",
      "filePath": "src/config.ts",
      "line": 42
    }
  ],
  "count": 1
}
```

Exit code 1 if any issues found. Disable lint with `lint: false` in config.

See [Drift Detection](./drift-detection.md) for details on drift types and categories.

### `drift examples [entry]`

Validate `@example` blocks on exports.

| Flag | Type | Description |
|------|------|-------------|
| `--typecheck` | boolean | Type-check examples with TypeScript |
| `--run` | boolean | Execute examples that contain `// =>` assertions (implies `--typecheck`). Installs the package with lifecycle scripts disabled. Own-package / CI is unsandboxed. Packages outside the workspace require OS isolation (`sandbox-exec` on macOS; other platforms refuse). |
| `--yes` | boolean | Confirm `--run`. Required when not a TTY unless `examples.run` is set in config. |
| `--untrusted` | boolean | Treat the target as a third-party package (force OS isolation). |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--min <n>` | number | Minimum example presence threshold (exit 1 if below) |

```bash
drift examples
drift examples --typecheck
drift examples --run
drift examples --min 50
```

Data shape:

```json
{
  "presence": {
    "total": 25,
    "withExamples": 18,
    "missing": ["parseConfig", "formatOutput"]
  },
  "typecheck": {
    "total": 18,
    "passed": 16,
    "failed": 2,
    "errors": [...]
  }
}
```

---

## Extraction Commands

### `drift extract [entry]`

Extract full API spec as JSON.

| Flag | Type | Description |
|------|------|-------------|
| `-o, --output <file>` | string | Write JSON to file instead of stdout |
| `--only <patterns>` | string | Include exports matching glob (comma-separated) |
| `--ignore <patterns>` | string | Exclude exports matching glob (comma-separated) |
| `--max-depth <n>` | number | Max type resolution depth (default: 10) |
| `--all` | boolean | Extract from all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--lang <language>` | string | Source language: inferred from `--spec`/`--abi`/`.clar`; default `typescript` |
| `--abi <path>` | string | ABI JSON file (required for Clarity) |
| `--spec <path>` | string | OpenAPI 3.x JSON document — path or URL (implies openapi) |

```bash
drift extract
drift extract -o api-spec.json
drift extract --only "parse*,format*"
drift extract --all
```

### `drift list [searchOrEntry]`

List exports. Positional arg is a search term or entry file path.

| Flag | Type | Description |
|------|------|-------------|
| `--kind <kinds>` | string | Filter by kind (comma-separated: function,class,interface,...) |
| `--undocumented` | boolean | Only exports missing JSDoc |
| `--drifted` | boolean | Only exports with stale JSDoc |
| `--full` | boolean | Show full list (no truncation) |
| `--all` | boolean | Run across all workspace packages |
| `--lang <language>` | string | Source language: inferred from `--spec`/`--abi`/`.clar`; default `typescript` |
| `--abi <path>` | string | ABI JSON file (required for Clarity) |
| `--spec <path>` | string | OpenAPI 3.x JSON document — path or URL (implies openapi) |

```bash
drift list
drift list parse
drift list --kind function,class
drift list --undocumented
drift list --drifted
```

Data shape:

```json
{
  "exports": [
    { "name": "parseConfig", "kind": "function", "description": "Parse configuration" },
    { "name": "Client", "kind": "class", "deprecated": true }
  ],
  "search": "parse",
  "showAll": false
}
```

### `drift get <name>`

Inspect single export detail and types. Entry auto-detected; pass it as the first arg to override (`drift get <entry> <name>`).

```bash
drift get parseConfig
drift get src/index.ts Client
```

---

## Spec Operations

### `drift validate <spec>`

Validate a spec file against the schema.

```bash
drift validate api-spec.json
```

### `drift filter <spec>`

Filter exports in a spec by kind, search, or tag.

```bash
drift filter api-spec.json --kind function
```

---

## Comparison Commands

### `drift diff [old] [new]`

Show what changed between two specs. Exits 1 if breaking changes detected.

| Flag | Type | Description |
|------|------|-------------|
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |

```bash
drift diff api-v1.json api-v2.json
drift diff --base main
drift diff --base main --head feature
```

### `drift breaking [old] [new]`

Detect breaking changes between two specs. Exits 1 if breaking changes found.

| Flag | Type | Description |
|------|------|-------------|
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |
| `--all` | boolean | Run across all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |

```bash
drift breaking api-v1.json api-v2.json
drift breaking --base main
```

### `drift semver [old] [new]`

Recommend semver bump based on API changes.

| Flag | Type | Description |
|------|------|-------------|
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |

```bash
drift semver api-v1.json api-v2.json
drift semver --base main
```

### `drift changelog [old] [new]`

Generate changelog from API diff.

| Flag | Type | Description |
|------|------|-------------|
| `--format <fmt>` | string | Output format: md or json (default: md) |
| `--base <ref>` | string | Git ref for old spec |
| `--head <ref>` | string | Git ref for new spec (default: working tree) |
| `--entry <file>` | string | Entry file for git ref extraction |

```bash
drift changelog api-v1.json api-v2.json
drift changelog --base main --format json
```

---

## Release and Reporting

### `drift release [entry]`

Pre-publish documentation audit. Checks coverage threshold and lint. Exit code 1 if not release-ready.

```bash
drift release
```

Data shape:

```json
{
  "ready": true,
  "coverage": 92,
  "coveragePass": true,
  "lintIssues": 0,
  "lintPass": true,
  "total": 45,
  "documented": 41,
  "undocumented": ["internalHelper"],
  "reasons": [],
  "lastTag": "v1.2.0",
  "pkgVersion": "1.3.0",
  "min": 80
}
```

### `drift report`

Documentation trends from history data.

```bash
drift report
```

---

## Agent Integration

### `drift mcp`

Run a stdio MCP server exposing drift's truth primitives to any MCP client (Claude Code, Cursor, custom agents).

```bash
# Claude Code
claude mcp add drift -- drift mcp

# Any MCP client: command = drift, args = ["mcp"]
```

Tools: `drift_extract`, `drift_list`, `drift_get`, `drift_scan`, `drift_lint`, `drift_coverage`, `drift_health` (all accept `cwd`, `entry`, `lang`, `spec` path/URL, `abi`), plus `drift_diff` and `drift_breaking` (TypeScript only today). Each tool returns the same `{ok, data, meta}` envelope as the CLI's `--json` mode.

```
drift_get { name: "candidateInfo", spec: "https://developers.ashbyhq.com/openapi/ashby-api.json" }
→ authoritative operation definition: params, required, types, deprecation
```

---

## Setup Commands

### `drift init`

Scan packages and generate drift config (`~/.drift/config.json` by default).

| Flag | Type | Description |
|------|------|-------------|
| `--project` | boolean | Write to `drift.config.json` in cwd instead of global config |

```bash
drift init
drift init --project
```

### `drift config`

Manage drift configuration. See [Configuration](./configuration.md) for full details.

```bash
drift config list
drift config get coverage.min
drift config set coverage.min 80
drift config set coverage.min 80 --project
```

### `drift context [entry]`

Generate agent context file with project state.

| Flag | Type | Description |
|------|------|-------------|
| `--all` | boolean | Include all workspace packages |
| `--private` | boolean | Include private packages in `--all` mode |
| `--output <path>` | string | Output path (default: `~/.drift/projects/<slug>/context.md`) |

```bash
drift context
drift context --all
drift context --output ./context.md
```

### `drift cache`

Cache management (clear, status).

```bash
drift cache clear
drift cache status
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed |
| 1 | Threshold not met, lint issues found, or command error |

## Discovery

```bash
# Machine-readable JSON of all commands, flags, entities, and workflows
drift --tools
```

Useful for AI agents and tooling integration. Returns command metadata, entity operations, and suggested workflows.
