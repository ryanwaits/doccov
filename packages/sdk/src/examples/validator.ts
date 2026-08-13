/**
 * Unified example validation.
 */
import type { ApiExample, ApiExport } from '../analysis/api-spec';
import {
  detectExampleAssertionFailures,
  detectExampleRuntimeErrors,
  hasNonAssertionComments,
  parseAssertions,
} from '../analysis/docs-coverage';
import { typecheckExamples } from '../typecheck/example-typechecker';
import type { ExampleTypeError } from '../typecheck/types';
import type { ExampleRunResult } from '../utils/example-runner';
import { runExamplesWithPackage } from '../utils/example-runner';
import type { ExampleValidation } from './types';
import { shouldValidate } from './types';

/**
 * Options for example validation.
 */
export interface ExampleValidationOptions {
  /** Which validations to run */
  validations: ExampleValidation[];
  /** Path to the package being validated */
  packagePath: string;
  /** Package name (for import resolution) */
  packageName?: string;
  /** All export names (for import statements in typecheck) */
  exportNames?: string[];
  /** Timeout for runtime execution (ms) */
  timeout?: number;
  /** Timeout for package installation (ms) */
  installTimeout?: number;
  /** Package manager override for the install step */
  packageManager?: 'npm' | 'pnpm' | 'bun' | 'yarn';
  /**
   * Treat the target as third-party (OS isolation required).
   * Default: auto — local workspace is trusted, anything else is not.
   */
  untrusted?: boolean;
  /** Working directory used to decide workspace-local vs third-party */
  cwd?: string;
  /** Callback for LLM assertion parsing fallback */
  llmAssertionParser?: (
    example: string,
  ) => Promise<{ hasAssertions: boolean; assertions: LLMAssertion[] } | null>;
}

/**
 * LLM-parsed assertion from non-standard comment syntax.
 */
export interface LLMAssertion {
  expected: string;
  suggestedSyntax: string;
}

/**
 * Result of a single example type error.
 */
export interface ExampleValidationTypeError {
  exportName: string;
  exampleIndex: number;
  error: ExampleTypeError;
}

/**
 * Result of example presence validation.
 */
export interface PresenceResult {
  total: number;
  withExamples: number;
  missing: string[];
}

/**
 * Result of example typecheck validation.
 */
export interface TypecheckValidationResult {
  passed: number;
  failed: number;
  errors: ExampleValidationTypeError[];
}

/**
 * Runtime drift issue (runtime error or assertion failure).
 */
export interface RuntimeDrift {
  exportName: string;
  issue: string;
  suggestion?: string;
}

/**
 * Result of example runtime validation.
 */
export interface RunValidationResult {
  passed: number;
  failed: number;
  /** Examples with no // => assertion — type-checked, not executed */
  skipped: number;
  drifts: RuntimeDrift[];
  installSuccess: boolean;
  installError?: string;
}

/**
 * Unified result from example validation.
 */
export interface ExampleValidationResult {
  /** Which validations were run */
  validations: ExampleValidation[];

  /** Presence validation results (if run) */
  presence?: PresenceResult;

  /** Typecheck validation results (if run) */
  typecheck?: TypecheckValidationResult;

  /** Runtime validation results (if run) */
  run?: RunValidationResult;

  /** Total number of issues found */
  totalIssues: number;
}

/**
 * Get string examples from an export, filtering out structured examples.
 */
function getStringExamples(exp: ApiExport): string[] {
  if (!exp.examples || exp.examples.length === 0) {
    return [];
  }
  return exp.examples
    .map((e) => (typeof e === 'string' ? e : (e as ApiExample).code))
    .filter((e): e is string => typeof e === 'string');
}

/**
 * Validate examples across exports.
 *
 * Runs only the validations specified. Each validation is independent:
 * - `presence`: checks examples exist (doesn't require typecheck or run)
 * - `typecheck`: type-checks examples (doesn't require presence or run)
 * - `run`: executes examples that contain // => assertions (Go polarity)
 */
export async function validateExamples(
  exports: ApiExport[],
  options: ExampleValidationOptions,
): Promise<ExampleValidationResult> {
  const {
    validations,
    packagePath,
    packageName,
    exportNames,
    timeout = 5000,
    installTimeout = 60000,
  } = options;

  const result: ExampleValidationResult = {
    validations,
    totalIssues: 0,
  };

  // No validations = early return
  if (validations.length === 0) {
    return result;
  }

  // === Presence validation ===
  if (shouldValidate(validations, 'presence')) {
    result.presence = {
      total: exports.length,
      withExamples: 0,
      missing: [],
    };

    for (const exp of exports) {
      const hasExamples = exp.examples && exp.examples.length > 0;
      if (hasExamples) {
        result.presence.withExamples++;
      } else {
        result.presence.missing.push(exp.name);
      }
    }

    result.totalIssues += result.presence.missing.length;
  }

  // === Typecheck validation ===
  if (shouldValidate(validations, 'typecheck')) {
    const typecheckErrors: ExampleValidationTypeError[] = [];
    let passed = 0;
    let failed = 0;

    // Collect all export names for import statements
    const allExportNames = exportNames ?? exports.map((e) => e.name);

    for (const exp of exports) {
      const examples = getStringExamples(exp);
      if (examples.length === 0) continue;

      const typecheckResult = typecheckExamples(examples, packagePath, {
        packageName,
        exportNames: allExportNames,
      });

      passed += typecheckResult.passed;
      failed += typecheckResult.failed;

      for (const error of typecheckResult.errors) {
        typecheckErrors.push({
          exportName: exp.name,
          exampleIndex: error.exampleIndex,
          error,
        });
      }
    }

    result.typecheck = {
      passed,
      failed,
      errors: typecheckErrors,
    };

    result.totalIssues += typecheckErrors.length;
  }

  // === Run validation ===
  // Go polarity: examples without // => assertions are type-checked (above)
  // but not executed. Execution is opt-in via the assertion itself.
  if (shouldValidate(validations, 'run')) {
    const runtimeDrifts: RuntimeDrift[] = [];
    const runnable: Array<{ exportName: string; exampleIndex: number; code: string }> = [];
    let skipped = 0;

    for (const exp of exports) {
      const examples = getStringExamples(exp);
      for (let i = 0; i < examples.length; i++) {
        if (parseAssertions(examples[i]).length > 0) {
          runnable.push({ exportName: exp.name, exampleIndex: i, code: examples[i] });
        } else if (examples[i].trim()) {
          skipped++;
        }
      }
    }

    let passed = 0;
    let failed = 0;
    let installSuccess = true;
    let installError: string | undefined;

    if (runnable.length > 0) {
      process.stderr.write(
        '\u26a0 run installs the package (lifecycle scripts disabled) and executes @example blocks that contain // => assertions.\n',
      );

      const packageResult = await runExamplesWithPackage(
        runnable.map((r) => r.code),
        {
          packagePath,
          timeout,
          installTimeout,
          cwd: options.cwd ?? packagePath,
          untrusted: options.untrusted,
          packageManager: options.packageManager,
        },
      );

      installSuccess = packageResult.installSuccess;
      installError = packageResult.installError;

      if (packageResult.installSuccess) {
        const byExport = new Map<string, Map<number, ExampleRunResult>>();

        for (let i = 0; i < runnable.length; i++) {
          const res = packageResult.results.get(i);
          if (!res) continue;
          if (res.success) {
            passed++;
          } else {
            failed++;
          }
          const item = runnable[i];
          let bucket = byExport.get(item.exportName);
          if (!bucket) {
            bucket = new Map();
            byExport.set(item.exportName, bucket);
          }
          bucket.set(item.exampleIndex, res);
        }

        for (const [exportName, entryResults] of byExport) {
          const entry = exports.find((e) => e.name === exportName);
          if (!entry) continue;

          const runtimeErrorDrifts = detectExampleRuntimeErrors(entry, entryResults);
          for (const drift of runtimeErrorDrifts) {
            runtimeDrifts.push({
              exportName: entry.name,
              issue: drift.issue,
              suggestion: drift.suggestion,
            });
          }

          const assertionDrifts = detectExampleAssertionFailures(entry, entryResults);
          for (const drift of assertionDrifts) {
            runtimeDrifts.push({
              exportName: entry.name,
              issue: drift.issue,
              suggestion: drift.suggestion,
            });
          }

          // LLM fallback only applies to examples that already ran (have // =>).
          if (options.llmAssertionParser && entry.examples) {
            for (let exIdx = 0; exIdx < entry.examples.length; exIdx++) {
              const example = entry.examples[exIdx];
              const res = entryResults.get(exIdx);
              if (!res?.success || typeof example !== 'string') continue;

              const regexAssertions = parseAssertions(example);
              if (regexAssertions.length === 0 && hasNonAssertionComments(example)) {
                const llmResult = await options.llmAssertionParser(example);
                if (llmResult?.hasAssertions && llmResult.assertions.length > 0) {
                  const stdoutLines = res.stdout
                    .split('\n')
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0);

                  for (let aIdx = 0; aIdx < llmResult.assertions.length; aIdx++) {
                    const assertion = llmResult.assertions[aIdx];
                    const actual = stdoutLines[aIdx];

                    if (actual === undefined) {
                      runtimeDrifts.push({
                        exportName: entry.name,
                        issue: `Assertion expected "${assertion.expected}" but no output was produced`,
                        suggestion: `Consider using standard syntax: ${assertion.suggestedSyntax}`,
                      });
                    } else if (assertion.expected.trim() !== actual.trim()) {
                      runtimeDrifts.push({
                        exportName: entry.name,
                        issue: `Assertion failed: expected "${assertion.expected}" but got "${actual}"`,
                        suggestion: `Consider using standard syntax: ${assertion.suggestedSyntax}`,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    result.run = {
      passed,
      failed,
      skipped,
      drifts: runtimeDrifts,
      installSuccess,
      installError,
    };

    result.totalIssues += runtimeDrifts.length;
  }

  return result;
}
