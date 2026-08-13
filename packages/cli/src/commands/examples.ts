import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { ExampleValidation, ExampleValidationResult } from '@driftdev/sdk';
import { validateExamples } from '@driftdev/sdk';
import type { Command } from 'commander';
import { cachedExtract } from '../cache/cached-extract';
import { loadConfig } from '../config/loader';
import { renderBatchExamples } from '../formatters/batch';
import { renderExamples } from '../formatters/examples';
import { detectEntry } from '../utils/detect-entry';
import { formatError, formatOutput, type OutputNext } from '../utils/output';
import { getVersion } from '../utils/version';
import { discoverPackages, filterPublic } from '../utils/workspaces';

function findPackagePath(entryFile: string): string {
  let dir = path.dirname(entryFile);
  while (dir !== path.dirname(dir)) {
    try {
      readFileSync(path.join(dir, 'package.json'), 'utf-8');
      return dir;
    } catch {
      dir = path.dirname(dir);
    }
  }
  return path.dirname(entryFile);
}

export function registerExamplesCommand(program: Command): void {
  program
    .command('examples [entry]')
    .description('Validate @example blocks on exports')
    .option('--typecheck', 'Type-check examples with TypeScript')
    .option(
      '--run',
      'Execute examples that contain // => assertions (implies --typecheck; installs the package)',
    )
    .option('--yes', 'Confirm execution (required when not a TTY)')
    .option('--untrusted', 'Treat the target as a third-party package (OS isolation; macOS only)')
    .option('--all', 'Run across all workspace packages')
    .option('--private', 'Include private packages in --all mode')
    .option('--min <n>', 'Minimum presence threshold (exit 1 if below)')
    .action(
      async (
        entry: string | undefined,
        options: {
          typecheck?: boolean;
          run?: boolean;
          yes?: boolean;
          untrusted?: boolean;
          all?: boolean;
          private?: boolean;
          min?: string;
        },
      ) => {
        const startTime = Date.now();
        const version = getVersion();

        try {
          // Build validations
          const validations: ExampleValidation[] = ['presence'];
          if (options.typecheck || options.run) validations.push('typecheck');
          if (options.run) validations.push('run');

          const { config } = loadConfig();
          if (options.run) {
            const confirmed =
              Boolean(options.yes) || config.examples?.run === true || Boolean(process.stdin.isTTY);
            if (!confirmed) {
              formatError(
                'examples',
                '--run requires --yes or examples.run: true in config when not running interactively',
                startTime,
                version,
              );
              return;
            }
          }

          // --all batch mode
          if (options.all) {
            const allPackages = discoverPackages(process.cwd());
            if (!allPackages || allPackages.length === 0) {
              formatError('examples', 'No workspace packages found', startTime, version);
              return;
            }
            const skipped = options.private
              ? []
              : allPackages.filter((p) => p.private).map((p) => p.name);
            const packages = options.private ? allPackages : filterPublic(allPackages);
            if (packages.length === 0) {
              formatError('examples', 'No workspace packages found', startTime, version);
              return;
            }

            const rows: Array<{ name: string; exports: number; score: number }> = [];
            let totalWith = 0;
            let totalAll = 0;
            let hasFailures = false;

            for (const pkg of packages) {
              const { spec } = await cachedExtract(pkg.entry);
              const exps = spec.exports ?? [];
              const packagePath = findPackagePath(pkg.entry);
              const exportNames = exps.map((e) => e.name);
              const result = await validateExamples(exps, {
                validations,
                packagePath,
                exportNames,
                untrusted: options.untrusted,
              });

              const withEx = result.presence?.withExamples ?? 0;
              const total = result.presence?.total ?? exps.length;
              const score = total > 0 ? Math.round((withEx / total) * 100) : 100;
              rows.push({ name: pkg.name, exports: total, score });
              totalWith += withEx;
              totalAll += total;

              if (result.typecheck && result.typecheck.failed > 0) hasFailures = true;
              if (result.run && (result.run.failed > 0 || !result.run.installSuccess)) {
                hasFailures = true;
              }
            }

            const aggScore = totalAll > 0 ? Math.round((totalWith / totalAll) * 100) : 100;
            const data = {
              packages: rows,
              aggregate: { score: aggScore, withExamples: totalWith, total: totalAll },
              ...(skipped.length > 0 ? { skipped } : {}),
            };
            formatOutput('examples', data, startTime, version, renderBatchExamples);

            const minT = options.min ? parseInt(options.min, 10) : undefined;
            if (minT !== undefined && aggScore < minT) process.exitCode = 1;
            if (hasFailures) process.exitCode = 1;
            return;
          }

          // Single package mode
          const entryFile = entry
            ? path.resolve(process.cwd(), entry)
            : config.entry
              ? path.resolve(process.cwd(), config.entry)
              : detectEntry();

          const { spec } = await cachedExtract(entryFile);
          const exports = spec.exports ?? [];
          const packagePath = findPackagePath(entryFile);
          const exportNames = exports.map((e) => e.name);

          const result: ExampleValidationResult = await validateExamples(exports, {
            validations,
            packagePath,
            exportNames,
            untrusted: options.untrusted,
          });

          const missingCount = result.presence?.missing?.length ?? 0;
          const failedCount = (result.typecheck?.failed ?? 0) + (result.run?.failed ?? 0);
          const totalIssues = missingCount + failedCount;
          const next: OutputNext | undefined =
            totalIssues > 0
              ? {
                  suggested: 'drift-fix-examples skill',
                  reason: `${totalIssues} examples need attention`,
                }
              : undefined;

          formatOutput('examples', result, startTime, version, renderExamples, next);

          // Exit code logic
          const minThreshold = options.min ? parseInt(options.min, 10) : undefined;
          if (minThreshold !== undefined && result.presence) {
            const score =
              result.presence.total > 0
                ? Math.round((result.presence.withExamples / result.presence.total) * 100)
                : 100;
            if (score < minThreshold) process.exitCode = 1;
          }
          if (result.typecheck && result.typecheck.failed > 0) process.exitCode = 1;
          if (result.run && (result.run.failed > 0 || !result.run.installSuccess)) {
            process.exitCode = 1;
          }
        } catch (err) {
          formatError(
            'examples',
            err instanceof Error ? err.message : String(err),
            startTime,
            version,
          );
        }
      },
    );
}
