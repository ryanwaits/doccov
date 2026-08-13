/**
 * Example validation types and utilities.
 */

/**
 * Individual example validations that can be run.
 */
export type ExampleValidation = 'presence' | 'typecheck' | 'run';

/**
 * All validations (used when --examples is passed without values).
 */
export const ALL_VALIDATIONS: ExampleValidation[] = ['presence', 'typecheck', 'run'];

/**
 * Describes what each validation does.
 */
export const VALIDATION_INFO: Record<
  ExampleValidation,
  {
    label: string;
    description: string;
  }
> = {
  presence: {
    label: 'Presence',
    description: 'Check that @example blocks exist on exports',
  },
  typecheck: {
    label: 'Typecheck',
    description: 'Compile examples with TypeScript to catch type errors',
  },
  run: {
    label: 'Run',
    description: 'Execute examples that contain // => assertions',
  },
};

/**
 * Parse --examples flag value into validation set.
 *
 * @example
 * parseExamplesFlag(true)                  // ['presence', 'typecheck', 'run']
 * parseExamplesFlag('presence')            // ['presence']
 * parseExamplesFlag('typecheck,run')       // ['typecheck', 'run']
 * parseExamplesFlag(undefined)             // [] (no validation)
 */
export function parseExamplesFlag(value: boolean | string | undefined): ExampleValidation[] {
  // No flag = no validation
  if (value === undefined || value === false) {
    return [];
  }

  // Bare --examples = all validations
  if (value === true) {
    return [...ALL_VALIDATIONS];
  }

  // Parse comma-separated values
  const parts = value.split(',').map((s) => s.trim().toLowerCase());
  const validations: ExampleValidation[] = [];

  for (const part of parts) {
    if (part === 'presence' || part === 'typecheck' || part === 'run') {
      if (!validations.includes(part)) {
        validations.push(part);
      }
    } else {
      throw new Error(
        `Invalid --examples value: "${part}". Valid options: presence, typecheck, run`,
      );
    }
  }

  return validations;
}

/**
 * Check if a specific validation is enabled.
 */
export function shouldValidate(
  validations: ExampleValidation[],
  check: ExampleValidation,
): boolean {
  return validations.includes(check);
}
