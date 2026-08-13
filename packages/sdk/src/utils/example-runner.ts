import { type ChildProcess, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  allowlistEnv,
  isolationAvailable,
  isolationUnsupportedMessage,
  isWorkspaceLocal,
  wrapIsolatedNode,
} from './example-sandbox';
import { findProjectRoot } from './project-root';

export interface ExampleRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface RunExampleOptions {
  /** Timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** Working directory for execution */
  cwd?: string;
}

export interface RunExamplesWithPackageOptions extends RunExampleOptions {
  /** Path to the local package to install */
  packagePath: string;
  /** Package manager to use (auto-detected if not specified) */
  packageManager?: 'npm' | 'pnpm' | 'bun' | 'yarn';
  /** Timeout for package installation in ms (default: 60000) */
  installTimeout?: number;
  /**
   * Treat the target as third-party (OS isolation required).
   * Default: auto — local workspace is trusted, anything else is not.
   */
  untrusted?: boolean;
}

export interface RunExamplesWithPackageResult {
  /** Results for each example by index */
  results: Map<number, ExampleRunResult>;
  /** Whether package installation succeeded */
  installSuccess: boolean;
  /** Error message if installation failed or execution was refused */
  installError?: string;
  /** Total duration including install */
  totalDuration: number;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Strip markdown code block markers from example code
 */
function stripCodeBlockMarkers(code: string): string {
  return code
    .replace(/^```(?:ts|typescript|js|javascript)?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim();
}

function killProcessGroup(proc: ChildProcess): void {
  const pid = proc.pid;
  if (pid == null) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch {
      // already gone
    }
  }
}

/**
 * Spawn a command in its own process group. Resolve on 'exit' (not 'close')
 * so a pipe-holding grandchild cannot stall the promise. On timeout, kill
 * the whole group. A hard deadline resolves even if 'exit' never fires.
 */
function spawnWithTimeout(
  cmd: string,
  args: string[],
  options: { cwd: string; timeout: number; env?: NodeJS.ProcessEnv },
): Promise<CommandResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;
    let settled = false;

    const settle = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      clearTimeout(hardDeadlineId);
      resolve(result);
    };

    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      env: options.env ?? allowlistEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
      timeout: options.timeout,
    });

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      killed = true;
      killProcessGroup(proc);
    }, options.timeout);

    const hardDeadlineId = setTimeout(() => {
      killed = true;
      killProcessGroup(proc);
      settle({
        success: false,
        stdout,
        stderr: stderr || `Command timed out after ${options.timeout}ms`,
        exitCode: 1,
      });
    }, options.timeout + 1000);

    proc.on('exit', (exitCode) => {
      if (killed) {
        settle({
          success: false,
          stdout,
          stderr: stderr || `Command timed out after ${options.timeout}ms`,
          exitCode: exitCode ?? 1,
        });
      } else {
        settle({
          success: exitCode === 0,
          stdout,
          stderr,
          exitCode: exitCode ?? 1,
        });
      }
    });

    proc.on('error', (error) => {
      settle({
        success: false,
        stdout,
        stderr: error.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Run an example code snippet in an isolated Node process.
 * Uses Node 22+ --experimental-strip-types for direct TS execution.
 */
export async function runExample(
  code: string,
  options: RunExampleOptions & {
    isolate?: { packagePath: string; workDir: string };
  } = {},
): Promise<ExampleRunResult> {
  const { timeout = 5000, isolate } = options;
  const cwd = options.cwd ?? os.tmpdir();
  const cleanCode = stripCodeBlockMarkers(code);

  // Temp file lives next to node_modules when a package was installed.
  const tmpFile = path.join(
    cwd,
    `drift-example-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`,
  );

  const startTime = Date.now();

  try {
    fs.writeFileSync(tmpFile, cleanCode, 'utf-8');

    const nodeArgs = ['--experimental-strip-types', tmpFile];
    let cmd = 'node';
    let args = nodeArgs;

    if (isolate) {
      const wrapped = wrapIsolatedNode(nodeArgs, isolate);
      cmd = wrapped.cmd;
      args = wrapped.args;
    }

    const result = await spawnWithTimeout(cmd, args, { cwd, timeout });
    const duration = Date.now() - startTime;
    const timedOut = !result.success && /timed out after/.test(result.stderr);

    return {
      success: result.success,
      stdout: result.stdout,
      stderr: timedOut ? result.stderr || `Example timed out after ${timeout}ms` : result.stderr,
      exitCode: result.exitCode,
      duration,
    };
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run multiple examples and collect results
 */
export async function runExamples(
  examples: string[],
  options: RunExampleOptions = {},
): Promise<Map<number, ExampleRunResult>> {
  const results = new Map<number, ExampleRunResult>();

  for (let i = 0; i < examples.length; i++) {
    const example = examples[i];
    if (typeof example === 'string' && example.trim()) {
      results.set(i, await runExample(example, options));
    }
  }

  return results;
}

/**
 * Detect package manager from lockfiles, walking up to the project root
 * so a workspace package does not fall through to the npm default.
 */
function detectPackageManager(cwd: string): 'npm' | 'pnpm' | 'bun' | 'yarn' {
  let dir = path.resolve(cwd);
  const stop = path.resolve(findProjectRoot(cwd));
  const root = path.parse(dir).root;

  while (true) {
    if (fs.existsSync(path.join(dir, 'bun.lockb'))) return 'bun';
    if (fs.existsSync(path.join(dir, 'bun.lock'))) return 'bun';
    if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
    if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
    if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
    if (dir === stop || dir === root) break;
    dir = path.dirname(dir);
  }
  return 'npm';
}

/**
 * Get the install command and args for a package manager.
 * Lifecycle scripts are never enabled. If the install then produces no
 * usable package, the caller fails — it does not retry with scripts on.
 */
export function getInstallCommand(
  pm: 'npm' | 'pnpm' | 'bun' | 'yarn',
  packagePath: string,
): { cmd: string; args: string[] } {
  switch (pm) {
    case 'bun':
      return { cmd: 'bun', args: ['add', '--ignore-scripts', packagePath] };
    case 'pnpm':
      return { cmd: 'pnpm', args: ['add', '--ignore-scripts', packagePath] };
    case 'yarn':
      return { cmd: 'yarn', args: ['add', '--ignore-scripts', packagePath] };
    default:
      return {
        cmd: 'npm',
        args: ['install', '--ignore-scripts', '--legacy-peer-deps', packagePath],
      };
  }
}

function readPackageName(packagePath: string): string | undefined {
  try {
    const raw = fs.readFileSync(path.join(packagePath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { name?: unknown };
    return typeof pkg.name === 'string' ? pkg.name : undefined;
  } catch {
    return undefined;
  }
}

function packagePresent(workDir: string, name: string): boolean {
  return fs.existsSync(path.join(workDir, 'node_modules', ...name.split('/')));
}

function scriptsDisabledError(pm: string, detail: string): string {
  return (
    `${pm} install failed with --ignore-scripts. ` +
    'Lifecycle scripts are disabled and will not be retried. ' +
    detail
  );
}

/**
 * Copy a local package and strip `scripts`. npm (and yarn) run the target's
 * `prepare` while packing a directory even with --ignore-scripts; the copy
 * is how we keep that from being the first arbitrary code that runs.
 */
function stagePackageWithoutScripts(packagePath: string, dest: string): void {
  fs.cpSync(packagePath, dest, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(packagePath, src);
      if (!rel) return true;
      const parts = rel.split(path.sep);
      return !parts.includes('node_modules') && !parts.includes('.git');
    },
  });
  const pkgJsonPath = path.join(dest, 'package.json');
  const raw = fs.readFileSync(pkgJsonPath, 'utf-8');
  const pkg = JSON.parse(raw) as { scripts?: unknown };
  delete pkg.scripts;
  fs.writeFileSync(pkgJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/**
 * Run multiple examples with a pre-installed local package.
 * Creates a single temp directory, installs the package once,
 * runs all examples, then cleans up.
 */
export async function runExamplesWithPackage(
  examples: string[],
  options: RunExamplesWithPackageOptions,
): Promise<RunExamplesWithPackageResult> {
  const { packagePath, packageManager, installTimeout = 60000, timeout = 5000 } = options;

  const startTime = Date.now();
  const results = new Map<number, ExampleRunResult>();
  const absolutePackagePath = path.resolve(packagePath);
  const detectCwd = options.cwd ?? process.cwd();
  const untrusted = options.untrusted ?? !isWorkspaceLocal(absolutePackagePath, detectCwd);

  if (untrusted && !isolationAvailable()) {
    return {
      results,
      installSuccess: false,
      installError: isolationUnsupportedMessage(),
      totalDuration: Date.now() - startTime,
    };
  }

  const workDir = path.join(
    os.tmpdir(),
    `drift-examples-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  try {
    fs.mkdirSync(workDir, { recursive: true });
    // Node --permission realpath()s through /var → /private/var; use the
    // real path as cwd so --allow-fs-read matches what Node stats.
    const realWorkDir = fs.realpathSync(workDir);

    // trustedDependencies: [] replaces Bun's default-trusted list (366 pkgs).
    // --ignore-scripts alone does not close the bun add path.
    const pkgJson = {
      name: 'drift-example-runner',
      type: 'module',
      trustedDependencies: [] as string[],
    };
    fs.writeFileSync(path.join(realWorkDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    const stagedPkg = path.join(realWorkDir, '.drift-pkg');
    stagePackageWithoutScripts(absolutePackagePath, stagedPkg);
    const realStagedPkg = fs.realpathSync(stagedPkg);

    const pm = packageManager ?? detectPackageManager(detectCwd);
    const { cmd, args } = getInstallCommand(pm, realStagedPkg);

    const installResult = await spawnWithTimeout(cmd, args, {
      cwd: realWorkDir,
      timeout: installTimeout,
    });

    if (!installResult.success) {
      return {
        results,
        installSuccess: false,
        installError: scriptsDisabledError(
          pm,
          installResult.stderr || `exit code ${installResult.exitCode}`,
        ),
        totalDuration: Date.now() - startTime,
      };
    }

    const installedName = readPackageName(realStagedPkg);
    if (installedName && !packagePresent(realWorkDir, installedName)) {
      return {
        results,
        installSuccess: false,
        installError: scriptsDisabledError(
          pm,
          `${installedName} is not present in node_modules after install.`,
        ),
        totalDuration: Date.now() - startTime,
      };
    }

    const isolate = untrusted ? { packagePath: realStagedPkg, workDir: realWorkDir } : undefined;

    for (let i = 0; i < examples.length; i++) {
      const example = examples[i];
      if (typeof example === 'string' && example.trim()) {
        results.set(i, await runExample(example, { timeout, cwd: realWorkDir, isolate }));
      }
    }

    return {
      results,
      installSuccess: true,
      totalDuration: Date.now() - startTime,
    };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

export { isolationAvailable, isolationUnsupportedMessage, isWorkspaceLocal };
