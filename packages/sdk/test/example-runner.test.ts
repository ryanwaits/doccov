/**
 * Fixture tests for example --run: Go polarity, ignore-scripts,
 * process-group timeout, and OS isolation on the untrusted path.
 */
import { afterEach, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { validateExamples } from '../src/examples/validator';
import {
  getInstallCommand,
  isolationAvailable,
  isWorkspaceLocal,
  runExample,
  runExamplesWithPackage,
} from '../src/utils/example-runner';
import { createDocumentedFunction, createExport } from './test-helpers';

setDefaultTimeout(60000);

const tmpDirs: string[] = [];

function tmpDir(prefix: string): string {
  const dir = path.join(
    os.tmpdir(),
    `drift-run-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

function writePkg(
  dir: string,
  opts: {
    name: string;
    files?: Record<string, string>;
    scripts?: Record<string, string>;
  },
): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: opts.name,
        version: '1.0.0',
        type: 'module',
        main: 'index.js',
        ...(opts.scripts ? { scripts: opts.scripts } : {}),
      },
      null,
      2,
    ),
  );
  writeFileSync(
    path.join(dir, 'index.js'),
    opts.files?.['index.js'] ?? 'export const value = 1;\n',
  );
  for (const [file, content] of Object.entries(opts.files ?? {})) {
    if (file === 'index.js') continue;
    writeFileSync(path.join(dir, file), content);
  }
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

describe('getInstallCommand', () => {
  test('passes --ignore-scripts on all four package managers', () => {
    const pkg = '/tmp/some-pkg';
    for (const pm of ['npm', 'pnpm', 'bun', 'yarn'] as const) {
      const { args } = getInstallCommand(pm, pkg);
      expect(args).toContain('--ignore-scripts');
      expect(args).toContain(pkg);
    }
  });
});

describe('isWorkspaceLocal', () => {
  test('this repo is local; a tmpdir package is not', () => {
    expect(isWorkspaceLocal(path.resolve(__dirname, '..'), process.cwd())).toBe(true);
    expect(isWorkspaceLocal(tmpDir('foreign'), process.cwd())).toBe(false);
  });
});

describe('Go polarity', () => {
  test('example with no assertion is type-checked and skipped at run time', async () => {
    const pkgDir = tmpDir('polarity');
    writePkg(pkgDir, { name: 'polarity-pkg' });
    const ranMarker = path.join(pkgDir, 'SHOULD_NOT_EXIST');

    const typecheck = await validateExamples(
      [createDocumentedFunction('value', { examples: ['const x: number = 1;'] })],
      { validations: ['typecheck'], packagePath: pkgDir },
    );
    expect(typecheck.typecheck).toBeDefined();
    expect(typecheck.typecheck!.failed).toBe(0);
    expect(typecheck.typecheck!.passed).toBe(1);

    const run = await validateExamples(
      [
        createDocumentedFunction('value', {
          examples: [
            `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(ranMarker)}, 'ran');`,
            `import { value } from 'polarity-pkg';\nconsole.log(value);\n// => 1`,
          ],
        }),
      ],
      {
        validations: ['run'],
        packagePath: pkgDir,
        packageName: 'polarity-pkg',
        untrusted: false,
      },
    );

    expect(run.run).toBeDefined();
    expect(run.run!.skipped).toBe(1);
    expect(run.run!.installSuccess).toBe(true);
    expect(run.run!.passed).toBe(1);
    expect(run.run!.failed).toBe(0);
    expect(existsSync(ranMarker)).toBe(false);
  });

  test('all-illustrative examples skip install', async () => {
    const result = await validateExamples(
      [createDocumentedFunction('foo', { examples: ['const x = 1;'] })],
      { validations: ['run'], packagePath: '/fake/path' },
    );
    expect(result.run!.skipped).toBe(1);
    expect(result.run!.passed).toBe(0);
    expect(result.run!.installSuccess).toBe(true);
  });
});

describe('ignore-scripts', () => {
  function hookPkg(pm: 'npm' | 'bun'): { pkgDir: string; sentinel: string } {
    const pkgDir = tmpDir(`hooks-${pm}`);
    const sentinel = path.join(os.tmpdir(), `drift-sentinel-${pm}-${Date.now()}`);
    tmpDirs.push(sentinel);
    writePkg(pkgDir, {
      name: `hook-pkg-${pm}`,
      scripts: {
        postinstall: `node -e "require('fs').writeFileSync(${JSON.stringify(sentinel)}, 'postinstall')"`,
        prepare: `node -e "require('fs').writeFileSync(${JSON.stringify(`${sentinel}.prepare`)}, 'prepare')"`,
      },
    });
    return { pkgDir, sentinel };
  }

  test('npm install does not fire postinstall or prepare', async () => {
    const { pkgDir, sentinel } = hookPkg('npm');
    const result = await runExamplesWithPackage(
      [`import { value } from 'hook-pkg-npm';\nconsole.log(value);\n// => 1`],
      { packagePath: pkgDir, packageManager: 'npm', untrusted: false, timeout: 8000 },
    );
    expect(result.installSuccess).toBe(true);
    expect(existsSync(sentinel)).toBe(false);
    expect(existsSync(`${sentinel}.prepare`)).toBe(false);
    expect(result.results.get(0)?.success).toBe(true);
  });

  test('bun add does not fire postinstall or prepare', async () => {
    const { pkgDir, sentinel } = hookPkg('bun');
    const result = await runExamplesWithPackage(
      [`import { value } from 'hook-pkg-bun';\nconsole.log(value);\n// => 1`],
      { packagePath: pkgDir, packageManager: 'bun', untrusted: false, timeout: 8000 },
    );
    expect(result.installSuccess).toBe(true);
    expect(existsSync(sentinel)).toBe(false);
    expect(existsSync(`${sentinel}.prepare`)).toBe(false);
    expect(result.results.get(0)?.success).toBe(true);
  });
});

describe('process-group timeout', () => {
  test('sleep 20 under a 3s timeout resolves in under ~4s and the descendant is gone', async () => {
    const marker = path.join(os.tmpdir(), `drift-timeout-pid-${Date.now()}`);
    tmpDirs.push(marker);
    const code = `
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const child = spawn('sleep', ['20'], { stdio: ['ignore', 'pipe', 'pipe'] });
writeFileSync(${JSON.stringify(marker)}, String(child.pid));
await new Promise((r) => setTimeout(r, 60_000));
`;
    const start = Date.now();
    const result = await runExample(code, { timeout: 3000 });
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(4000);
    expect(result.success).toBe(false);
    expect(result.stderr).toMatch(/timed out/i);

    expect(existsSync(marker)).toBe(true);
    const childPid = Number(await Bun.file(marker).text());
    expect(childPid).toBeGreaterThan(0);
    let alive = true;
    try {
      process.kill(childPid, 0);
    } catch {
      alive = false;
    }
    expect(alive).toBe(false);
  });
});

describe('env allowlist', () => {
  test('example process does not inherit planted secrets', async () => {
    process.env.DRIFT_SECRET_TEST = 'should-not-leak';
    try {
      const result = await runExample('console.log(process.env.DRIFT_SECRET_TEST ?? "absent")');
      expect(result.success).toBe(true);
      expect(result.stdout.trim()).toBe('absent');
    } finally {
      delete process.env.DRIFT_SECRET_TEST;
    }
  });
});

describe('OS isolation (untrusted path)', () => {
  test('refuses to run untrusted packages when isolation is unavailable', async () => {
    if (isolationAvailable()) return;
    const pkgDir = tmpDir('refuse');
    writePkg(pkgDir, { name: 'refuse-pkg' });
    const result = await runExamplesWithPackage(
      [`import { value } from 'refuse-pkg';\nconsole.log(value);\n// => 1`],
      { packagePath: pkgDir, untrusted: true, timeout: 8000 },
    );
    expect(result.installSuccess).toBe(false);
    expect(result.installError).toMatch(/OS isolation is unavailable/i);
    expect(result.results.size).toBe(0);
  });

  test('legitimate example still imports the package', async () => {
    if (!isolationAvailable()) return;
    const pkgDir = tmpDir('ok');
    writePkg(pkgDir, {
      name: 'iso-ok',
      files: { 'index.js': 'export const greet = () => "hello";\n' },
    });
    const result = await runExamplesWithPackage(
      [`import { greet } from 'iso-ok';\nconsole.log(greet());\n// => hello`],
      { packagePath: pkgDir, untrusted: true, timeout: 10000 },
    );
    expect(result.installSuccess).toBe(true);
    const run = result.results.get(0);
    expect(run?.success).toBe(true);
    expect(run?.stdout.trim()).toBe('hello');
  });

  test('network egress is denied', async () => {
    if (!isolationAvailable()) return;
    const pkgDir = tmpDir('net');
    writePkg(pkgDir, { name: 'iso-net' });
    const result = await runExamplesWithPackage(
      [
        `try {\n  await fetch('https://example.com');\n  console.log('NET_OK');\n} catch (e) {\n  console.log('NET_DENIED');\n}\n// => NET_DENIED`,
      ],
      { packagePath: pkgDir, untrusted: true, timeout: 10000 },
    );
    expect(result.installSuccess).toBe(true);
    const run = result.results.get(0);
    expect(run?.stdout.trim()).toBe('NET_DENIED');
  });

  test('~/.ssh reads are denied', async () => {
    if (!isolationAvailable()) return;
    const pkgDir = tmpDir('ssh');
    writePkg(pkgDir, { name: 'iso-ssh' });
    const result = await runExamplesWithPackage(
      [
        `import fs from 'node:fs';\nimport os from 'node:os';\ntry {\n  fs.readdirSync(os.homedir() + '/.ssh');\n  console.log('SSH_OK');\n} catch {\n  console.log('SSH_DENIED');\n}\n// => SSH_DENIED`,
      ],
      { packagePath: pkgDir, untrusted: true, timeout: 10000 },
    );
    expect(result.installSuccess).toBe(true);
    const run = result.results.get(0);
    expect(run?.stdout.trim()).toBe('SSH_DENIED');
  });

  test('child-process exfil is denied', async () => {
    if (!isolationAvailable()) return;
    const pkgDir = tmpDir('child');
    writePkg(pkgDir, { name: 'iso-child' });
    const result = await runExamplesWithPackage(
      [
        `import { spawnSync } from 'node:child_process';\ntry {\n  spawnSync('curl', ['https://example.com']);\n  console.log('CHILD_OK');\n} catch {\n  console.log('CHILD_DENIED');\n}\n// => CHILD_DENIED`,
      ],
      { packagePath: pkgDir, untrusted: true, timeout: 10000 },
    );
    expect(result.installSuccess).toBe(true);
    const run = result.results.get(0);
    expect(run?.stdout.trim()).toBe('CHILD_DENIED');
  });
});

describe('validateExamples empty-run still reports installSuccess', () => {
  test('exports with no examples avoid runtime', async () => {
    const result = await validateExamples([createExport({ name: 'noExamples' })], {
      validations: ['run'],
      packagePath: '/fake/path',
    });
    expect(result.run!.installSuccess).toBe(true);
    expect(result.run!.skipped).toBe(0);
  });
});
