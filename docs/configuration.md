# Configuration

Drift uses JSON-only configuration. No code execution -- config is always a static JSON object.

## Who Should Configure Drift

- Teams enforcing docs thresholds in CI.
- Monorepos with package-specific entry points.
- Projects with non-default markdown docs locations.

## Why Configure It

- Set explicit quality gates (`coverage.min`, `coverage.ratchet`).
- Make entry detection deterministic in custom layouts.
- Control which docs files are included in prose drift detection.

## How To Approach It

1. Start with defaults and run `drift scan`.
2. Add only the minimum keys you need.
3. Keep team-wide policy in project config; keep personal defaults global.

## Config File Locations

Drift searches for config in this order (first match wins):

1. **`--config <path>`** flag (explicit override)
2. **`drift.config.json`** in current directory, then parent directories (walks up)
3. **`package.json` `"drift"` key** in current directory, then parent directories
4. **`~/.drift/config.json`** (global config)
5. **Built-in defaults** if nothing found

### Project-local: `drift.config.json`

```json
{
  "$schema": "https://unpkg.com/@driftdev/cli/schemas/drift.config.schema.json",
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

### Package.json `"drift"` key

```json
{
  "name": "my-lib",
  "version": "1.0.0",
  "drift": {
    "coverage": {
      "min": 80
    },
    "lint": true
  }
}
```

### Global: `~/.drift/config.json`

Applied when no project-local config is found. Useful for personal defaults.

```json
{
  "coverage": {
    "min": 60
  }
}
```

## All Config Keys

A JSON Schema ships with the CLI (`@driftdev/cli/schemas/drift.config.schema.json`). Add the `$schema` key for editor autocomplete and agent-authored config validation.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `$schema` | `string` | none | Schema URL for editor/agent validation (ignored at runtime) |
| `entry` | `string` | auto-detected | TypeScript entry point override |
| `coverage.min` | `number` (0-100) | none | Minimum coverage threshold (exit 1 if below) |
| `coverage.ratchet` | `boolean` | `false` | Ratchet: effective min = max(min, highest ever recorded) |
| `lint` | `boolean` | `true` | Enable lint checks |
| `docs.include` | `string[]` | `["README.md", "docs/**/*.md", "docs/**/*.mdx"]` | Glob patterns for markdown discovery (prose drift) |
| `docs.exclude` | `string[]` | `["node_modules/**", "dist/**", ".git/**"]` | Glob patterns to exclude from markdown discovery |
| `examples.run` | `boolean` | `false` | Allow `drift examples --run` in non-TTY (CI) without `--yes` |

## Managing Config with `drift config`

### List all config values

```bash
drift config list
```

Shows all resolved config values with their source:

```json
{
  "entries": [
    { "key": "lint", "value": true },
    { "key": "coverage.min", "value": 80 },
    { "key": "coverage.ratchet", "value": true }
  ],
  "configPath": "/path/to/drift.config.json"
}
```

### Get a single value

```bash
drift config get coverage.min
```

Uses dot-notation for nested keys:

```bash
drift config get docs.include
drift config get lint
```

### Set a value

By default, writes to **global** config (`~/.drift/config.json`):

```bash
drift config set coverage.min 80
drift config set lint false
drift config set docs.include "README.md,docs/**/*.md"
```

Use `--project` to write to `drift.config.json` in the current directory:

```bash
drift config set coverage.min 80 --project
drift config set coverage.ratchet true --project
```

### Value coercion

`drift config set` auto-coerces values:

| Input | Result | Type |
|-------|--------|------|
| `80` | `80` | number |
| `true` | `true` | boolean |
| `false` | `false` | boolean |
| `null` | `null` | null |
| `README.md,docs/**/*.md` | `["README.md", "docs/**/*.md"]` | array |
| `src/index.ts` | `"src/index.ts"` | string |

## Entry Point Detection

If `entry` is not set in config, drift auto-detects from `package.json`:
- `"types"` / `"typings"` field
- `"exports"` field (`.` entry)
- `"main"` field
- `"module"` field
- `"bin"` field (CLI packages)

Falls back to common patterns like `src/index.ts`.

## State Directory

All drift state lives in `~/.drift/`:

```
~/.drift/
  config.json              # global config
  projects/
    <project-slug>/
      context.md           # agent context file
      history.jsonl         # coverage/lint history
```

No files are written to your project directory unless you explicitly use `drift init` or `drift config set --project`.

## Validation

Config is validated on load. Invalid keys produce clear error messages:

```
Invalid config at drift.config.json: "coverage.min" must be a number 0-100
```

The `drift init` command creates a global config at `~/.drift/config.json`. Use `drift config set --project` to create a project-local `drift.config.json`.
