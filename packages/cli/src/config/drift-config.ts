/**
 * Drift config schema. JSON-only, no code execution.
 * Loaded from drift.config.json or package.json "drift" key.
 */

export interface RemoteDocsTarget {
  /** Target repo in "owner/repo" format */
  repo: string;
  /** Target branch (defaults to repo's default branch) */
  branch?: string;
}

export interface DriftConfig {
  /** Entry point override (otherwise auto-detected) */
  entry?: string;
  /** Coverage thresholds */
  coverage?: {
    /** Minimum coverage % (exit 1 if below) */
    min?: number;
    /** Ratchet: effective min = max(min, highest_ever) */
    ratchet?: boolean;
  };
  /** Enable lint checks (default true) */
  lint?: boolean;
  /** Markdown docs discovery patterns */
  docs?: {
    include?: string[];
    exclude?: string[];
    /** Remote repos to sync docs on breaking changes */
    remote?: RemoteDocsTarget[];
  };
  /** Example execution policy */
  examples?: {
    /** Allow --run in non-TTY (CI) without --yes */
    run?: boolean;
  };
}

const DEFAULTS: DriftConfig = {
  lint: true,
};

export function mergeDefaults(config: DriftConfig): DriftConfig {
  return {
    ...DEFAULTS,
    ...config,
    coverage: {
      ...DEFAULTS.coverage,
      ...config.coverage,
    },
  };
}

export function validateConfig(
  raw: unknown,
): { ok: true; config: DriftConfig } | { ok: false; errors: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['Config must be a JSON object'] };
  }

  const errors: string[] = [];
  const obj = raw as Record<string, unknown>;

  if (obj.entry !== undefined && typeof obj.entry !== 'string') {
    errors.push('"entry" must be a string');
  }

  if (obj.coverage !== undefined) {
    if (typeof obj.coverage !== 'object' || obj.coverage === null) {
      errors.push('"coverage" must be an object');
    } else {
      const cov = obj.coverage as Record<string, unknown>;
      if (cov.min !== undefined && (typeof cov.min !== 'number' || cov.min < 0 || cov.min > 100)) {
        errors.push('"coverage.min" must be a number 0-100');
      }
      if (cov.ratchet !== undefined && typeof cov.ratchet !== 'boolean') {
        errors.push('"coverage.ratchet" must be a boolean');
      }
    }
  }

  if (obj.lint !== undefined && typeof obj.lint !== 'boolean') {
    errors.push('"lint" must be a boolean');
  }

  if (obj.docs !== undefined) {
    if (typeof obj.docs !== 'object' || obj.docs === null) {
      errors.push('"docs" must be an object');
    } else {
      const docs = obj.docs as Record<string, unknown>;
      if (
        docs.include !== undefined &&
        (!Array.isArray(docs.include) || !docs.include.every((i) => typeof i === 'string'))
      ) {
        errors.push('"docs.include" must be an array of strings');
      }
      if (
        docs.exclude !== undefined &&
        (!Array.isArray(docs.exclude) || !docs.exclude.every((i) => typeof i === 'string'))
      ) {
        errors.push('"docs.exclude" must be an array of strings');
      }
      if (docs.remote !== undefined) {
        if (!Array.isArray(docs.remote)) {
          errors.push('"docs.remote" must be an array');
        } else {
          for (let i = 0; i < docs.remote.length; i++) {
            const target = docs.remote[i] as Record<string, unknown>;
            if (typeof target !== 'object' || target === null) {
              errors.push(`"docs.remote[${i}]" must be an object`);
              continue;
            }
            if (typeof target.repo !== 'string' || !/^[^/]+\/[^/]+$/.test(target.repo)) {
              errors.push(`"docs.remote[${i}].repo" must be in "owner/repo" format`);
            }
            if (target.branch !== undefined && typeof target.branch !== 'string') {
              errors.push(`"docs.remote[${i}].branch" must be a string`);
            }
          }
        }
      }
    }
  }

  if (obj.examples !== undefined) {
    if (typeof obj.examples !== 'object' || obj.examples === null) {
      errors.push('"examples" must be an object');
    } else {
      const examples = obj.examples as Record<string, unknown>;
      if (examples.run !== undefined && typeof examples.run !== 'boolean') {
        errors.push('"examples.run" must be a boolean');
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  // $schema is an editor/agent affordance, not config
  const { $schema: _schema, ...rest } = obj;
  return { ok: true, config: mergeDefaults(rest as DriftConfig) };
}
