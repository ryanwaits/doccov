/**
 * OS isolation for untrusted example execution.
 *
 * sandbox-exec on macOS is the isolation boundary (network denied at the
 * socket layer, inherited by descendants). node --permission is defense in
 * depth only — Node's own docs say it does not provide security guarantees.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { findProjectRoot } from './project-root';

export const SANDBOX_EXEC = '/usr/bin/sandbox-exec';

const CREDENTIAL_PATHS = [
  '.ssh',
  '.gnupg',
  '.aws',
  '.npmrc',
  '.netrc',
  '.config/gh',
  '.git-credentials',
];

/**
 * Env allowlist for install + example spawns. No inherited tokens.
 */
export function allowlistEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  if (process.env.PATH) env.PATH = process.env.PATH;
  if (process.env.HOME) env.HOME = process.env.HOME;
  env.TMPDIR = process.env.TMPDIR ?? os.tmpdir();
  if (process.env.LANG) env.LANG = process.env.LANG;
  return env;
}

export function which(cmd: string): string | undefined {
  const pathEnv = process.env.PATH;
  if (!pathEnv) return undefined;
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, cmd);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return fs.realpathSync(candidate);
    } catch {
      // try next
    }
  }
  return undefined;
}

export function resolveNodeExecutable(): string {
  const execBase = path.basename(process.execPath);
  if (execBase === 'node' || execBase === 'node.exe') {
    try {
      return fs.realpathSync(process.execPath);
    } catch {
      return process.execPath;
    }
  }
  return which('node') ?? 'node';
}

export function nodePrefix(nodePath: string): string {
  // nvm/homebrew: <prefix>/bin/node → prefix is two up
  return path.resolve(nodePath, '..', '..');
}

/**
 * True when packagePath lives inside the caller's project root
 * (own package / own CI). False for a third-party tree being audited.
 */
export function isWorkspaceLocal(packagePath: string, cwd: string = process.cwd()): boolean {
  const absPkg = realExisting(packagePath);
  const root = realExisting(findProjectRoot(cwd));
  const rel = path.relative(root, absPkg);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function isolationAvailable(): boolean {
  return process.platform === 'darwin' && fs.existsSync(SANDBOX_EXEC);
}

export function isolationUnsupportedMessage(): string {
  return (
    'Refusing to execute examples: the target package is outside the workspace ' +
    'and OS isolation is unavailable on this platform (macOS sandbox-exec only).'
  );
}

export interface SandboxLaunch {
  cmd: string;
  args: string[];
}

/**
 * Wrap a node invocation in sandbox-exec + node --permission.
 * Caller must have already checked isolationAvailable().
 */
export function wrapIsolatedNode(
  nodeArgs: string[],
  opts: { workDir: string; packagePath: string },
): SandboxLaunch {
  const nodePath = resolveNodeExecutable();
  const workDir = realExisting(opts.workDir);
  const packagePath = realExisting(opts.packagePath);
  const home = os.homedir();
  const tmpDir = realExisting(process.env.TMPDIR ?? os.tmpdir());
  const profile = buildSandboxProfile({ workDir, packagePath, home, tmpDir });
  const permissionArgs = nodePermissionArgs({
    workDir,
    packagePath,
    nodePrefix: nodePrefix(nodePath),
  });

  return {
    cmd: SANDBOX_EXEC,
    args: ['-p', profile, nodePath, ...permissionArgs, ...nodeArgs],
  };
}

export function nodePermissionArgs(opts: {
  workDir: string;
  packagePath: string;
  nodePrefix: string;
}): string[] {
  // --allow-net does not exist before Node 26; omit it. Network is
  // denied by sandbox-exec, not by --permission.
  return [
    '--permission',
    `--allow-fs-read=${opts.workDir}`,
    `--allow-fs-read=${opts.packagePath}`,
    `--allow-fs-read=${opts.nodePrefix}`,
    `--allow-fs-write=${opts.workDir}`,
  ];
}

export function buildSandboxProfile(opts: {
  workDir: string;
  packagePath: string;
  home: string;
  tmpDir: string;
}): string {
  const denyReads = CREDENTIAL_PATHS.map(
    (rel) => `  (subpath ${sbplString(path.join(opts.home, rel))})`,
  ).join('\n');

  return `(version 1)
(deny default)
(allow process*)
(allow signal)
(allow sysctl-read)
(allow mach*)
(allow iokit-open)
(allow ipc-posix*)
(allow ipc-sysv*)
(allow system-socket)
(allow file-ioctl)
(allow file-map-executable)
(allow file-read-metadata)
(allow nvram-get)
(allow file-read*)
(deny file-read*
${denyReads}
)
(allow file-write*
  (subpath ${sbplString(opts.workDir)})
  (subpath ${sbplString(opts.tmpDir)})
  (subpath "/tmp")
  (subpath "/private/tmp")
  (subpath "/dev")
  (subpath "/private/var/folders")
)
(deny network*)
(deny network-outbound)
(deny network-inbound)
(deny network-bind)
`;
}

function sbplString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function realExisting(p: string): string {
  const resolved = path.resolve(p);
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}
