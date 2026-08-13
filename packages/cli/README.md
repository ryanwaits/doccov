# @driftdev/cli

Command-line interface for documentation coverage analysis and drift detection. Ships as the `drift` binary.

## Who This CLI Is For

- Maintainers of TypeScript libraries, SDKs, and CLI packages.
- Teams that want docs quality enforced in CI.
- Engineers building automation around machine-readable docs diagnostics.

## Why Use It

- Catch stale JSDoc, examples, and markdown references before release.
- Enforce quality thresholds with standard exit codes.
- Produce structured output that agents and tooling can act on directly.

## Install

```bash
bun add -g @driftdev/cli
```

## Quick Start

```bash
# Full scan: coverage + lint + prose drift + health
drift scan

# Check documentation coverage
drift coverage

# Find JSDoc accuracy issues
drift lint

# Validate @example blocks
drift examples
```

Entry auto-detects from `package.json` (`types`, `exports`, `main`, `module`, `bin`) for TypeScript packages with an exported API surface.

## Commands

### Composed

| Command | Description |
|---------|-------------|
| `drift scan [entry]` | Coverage + lint + prose drift + health in one pass (default command) |
| `drift health [entry]` | Documentation health score |
| `drift ci` | CI checks on changed packages with PR comments |

### Analysis

| Command | Description |
|---------|-------------|
| `drift coverage [entry]` | Documentation coverage score |
| `drift lint [entry]` | Cross-reference JSDoc vs code signatures |
| `drift examples [entry]` | Validate @example blocks (presence, typecheck, run) |

### Extraction

| Command | Description |
|---------|-------------|
| `drift extract [entry]` | Extract full API spec as JSON |
| `drift list [searchOrEntry]` | List all exports with kinds |
| `drift get <name>` | Inspect single export detail + types (entry auto-detected; `drift get <entry> <name>` to override) |

### Spec Operations

| Command | Description |
|---------|-------------|
| `drift validate <spec>` | Validate a spec file |
| `drift filter <spec>` | Filter exports by kind, search, tag |

### Comparison

| Command | Description |
|---------|-------------|
| `drift diff <old> <new>` | What changed between two specs |
| `drift breaking <old> <new>` | Detect breaking changes |
| `drift semver <old> <new>` | Recommend semver bump |
| `drift changelog <old> <new>` | Generate changelog |

### Setup & Plumbing

| Command | Description |
|---------|-------------|
| `drift init` | Create configuration file |
| `drift config` | Manage config (list, get, set) |
| `drift context` | Generate agent context file |
| `drift report` | Documentation trends from history |
| `drift release` | Pre-release documentation audit |
| `drift cache` | Cache management (clear, status) |

### Discovery

```bash
# Machine-readable list of all commands + flags
drift --tools
```

## Global Options

```
--json          Force JSON output (default when piped)
--human         Force human-readable output (default in terminal)
--config <path> Path to drift config file
--cwd <dir>     Run as if started in <dir>
--no-cache      Bypass spec cache
```

## scan

Run coverage + lint + prose drift + health in one pass.

Default command — bare `drift` runs this.

```bash
drift scan                    # single package (bare `drift` does the same)
drift scan --min 80           # fail if health below 80%
drift scan --all              # all workspace packages
drift scan --all --private    # include private packages
```

## lint

Cross-reference JSDoc against code signatures. Detects 17 drift types across 4 categories (structural, semantic, example, prose). Prose detection scans markdown files for broken import references, method calls that don't exist on any exported type, and references to deprecated APIs with no deprecation note.

```bash
drift lint                    # single package
drift lint --all              # all workspace packages
drift lint --json             # JSON output with filePath/line
```

## coverage

Documentation coverage score.

```bash
drift coverage                # single package
drift coverage --min 80       # fail if below 80%
drift coverage --all          # all workspace packages
```

## health

Weighted health score: completeness (coverage) + accuracy (lint).

```bash
drift health
drift health --min 80
drift health --all
```

## examples

Validate @example blocks.

```bash
drift examples                # presence check
drift examples --typecheck    # type-check examples
drift examples --run          # execute examples with // => assertions
drift examples --min 50       # fail if example coverage below 50%
```

## ci

CI checks with GitHub integration: PR comments, step summaries, history tracking.

```bash
drift ci                      # check changed packages
drift ci --all                # check all packages
drift ci --private            # include private packages
```

Generates `~/.drift/projects/<slug>/context.md` — machine-readable project state for agents.

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

See [Configuration docs](../../docs/configuration.md) for all keys and `drift config` commands.

## Output Format

All commands return structured JSON when piped or with `--json`:

```json
{
  "ok": true,
  "data": { "score": 88, "documented": 243, "total": 275 },
  "meta": { "command": "coverage", "duration": 1234, "version": "1.4.0" }
}
```

Human-readable output in terminal by default, or with `--human`.

## Monorepo Support

All analysis commands support `--all` for workspace batch mode:

```bash
drift scan --all              # scan all packages
drift coverage --all          # coverage per package
drift lint --all              # lint per package
```

Auto-detects workspace globs from `package.json`.

## License

MIT
