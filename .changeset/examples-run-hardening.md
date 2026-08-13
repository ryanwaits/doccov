---
"@driftdev/sdk": minor
"@driftdev/cli": minor
---

`--run` no longer executes every `@example` block, and the install/timeout path is no longer a hang or a script runner.

- **Go polarity:** examples without a `// =>` assertion are type-checked and skipped at run time. Execution is opt-in via the assertion itself.
- **Install:** `--ignore-scripts` on npm/pnpm/yarn/bun, plus `trustedDependencies: []` in the harness `package.json` so Bun's default-trusted list cannot run lifecycle scripts. Local packages are staged with `scripts` stripped first — npm still runs the target's `prepare` while packing a directory, even with `--ignore-scripts`. Failed installs are not retried with scripts enabled.
- **Timeout:** examples spawn detached; the process group is SIGKILL'd on timeout; the promise resolves on `'exit'` (with a hard deadline) so a pipe-holding grandchild cannot stall `--run`.
- **Untrusted packages** (outside the local workspace, or `--untrusted`): macOS `sandbox-exec` denies network and credential paths; `node --permission` sits underneath as defense in depth. Other platforms refuse rather than run unsandboxed. Own-package / CI is unsandboxed so real SDK examples can still call APIs.
- **Env allowlist** (`PATH`, `HOME`, `TMPDIR`, `LANG`) on install and example spawns.
- **`--yes`** or `examples.run` in config is required for `--run` when not a TTY.
- Docs: `--run` no longer claims to execute "in a sandbox." The warning now says it installs the package.
