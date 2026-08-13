/**
 * Tests for example validation logic.
 */
import { describe, expect, test } from 'bun:test';
import {
  ALL_VALIDATIONS,
  type ExampleValidation,
  parseExamplesFlag,
  shouldValidate,
} from '../src/examples/types';
import { validateExamples } from '../src/examples/validator';
import { createDocumentedFunction, createExport } from './test-helpers';

describe('parseExamplesFlag', () => {
  test('returns empty array for undefined', () => {
    const result = parseExamplesFlag(undefined);
    expect(result).toEqual([]);
  });

  test('returns empty array for false', () => {
    const result = parseExamplesFlag(false);
    expect(result).toEqual([]);
  });

  test('returns all validations for true', () => {
    const result = parseExamplesFlag(true);
    expect(result).toEqual(ALL_VALIDATIONS);
  });

  test('parses single validation', () => {
    expect(parseExamplesFlag('presence')).toEqual(['presence']);
    expect(parseExamplesFlag('typecheck')).toEqual(['typecheck']);
    expect(parseExamplesFlag('run')).toEqual(['run']);
  });

  test('parses comma-separated validations', () => {
    const result = parseExamplesFlag('presence,typecheck');
    expect(result).toContain('presence');
    expect(result).toContain('typecheck');
    expect(result).not.toContain('run');
  });

  test('deduplicates repeated validations', () => {
    const result = parseExamplesFlag('presence,presence,typecheck');
    expect(result).toHaveLength(2);
  });

  test('throws on invalid validation name', () => {
    expect(() => parseExamplesFlag('invalid')).toThrow('Invalid --examples value');
  });

  test('handles whitespace around values', () => {
    const result = parseExamplesFlag(' presence , typecheck ');
    expect(result).toContain('presence');
    expect(result).toContain('typecheck');
  });

  test('is case-insensitive', () => {
    const result = parseExamplesFlag('PRESENCE,Typecheck');
    expect(result).toContain('presence');
    expect(result).toContain('typecheck');
  });
});

describe('shouldValidate', () => {
  test('returns true if validation is in list', () => {
    const validations: ExampleValidation[] = ['presence', 'typecheck'];
    expect(shouldValidate(validations, 'presence')).toBe(true);
    expect(shouldValidate(validations, 'typecheck')).toBe(true);
  });

  test('returns false if validation is not in list', () => {
    const validations: ExampleValidation[] = ['presence'];
    expect(shouldValidate(validations, 'run')).toBe(false);
  });

  test('returns false for empty list', () => {
    expect(shouldValidate([], 'presence')).toBe(false);
  });
});

describe('validateExamples', () => {
  describe('empty validations', () => {
    test('returns immediately with no validations', async () => {
      const exports = [createExport({ name: 'foo' })];
      const result = await validateExamples(exports, {
        validations: [],
        packagePath: '/fake/path',
      });

      expect(result.validations).toHaveLength(0);
      expect(result.totalIssues).toBe(0);
    });
  });

  describe('presence validation', () => {
    test('counts exports with examples', async () => {
      const exports = [
        createDocumentedFunction('withExample', { examples: ['example()'] }),
        createExport({ name: 'withoutExample' }),
      ];

      const result = await validateExamples(exports, {
        validations: ['presence'],
        packagePath: '/fake/path',
      });

      expect(result.presence).toBeDefined();
      expect(result.presence!.total).toBe(2);
      expect(result.presence!.withExamples).toBe(1);
      expect(result.presence!.missing).toContain('withoutExample');
    });

    test('reports missing exports', async () => {
      const exports = [createExport({ name: 'foo' }), createExport({ name: 'bar' })];

      const result = await validateExamples(exports, {
        validations: ['presence'],
        packagePath: '/fake/path',
      });

      expect(result.presence!.missing).toHaveLength(2);
      expect(result.presence!.missing).toContain('foo');
      expect(result.presence!.missing).toContain('bar');
      expect(result.totalIssues).toBe(2);
    });

    test('handles empty exports array', async () => {
      const result = await validateExamples([], {
        validations: ['presence'],
        packagePath: '/fake/path',
      });

      expect(result.presence!.total).toBe(0);
      expect(result.presence!.withExamples).toBe(0);
      expect(result.presence!.missing).toHaveLength(0);
    });

    test('handles structured examples', async () => {
      const exports = [
        {
          ...createExport({ name: 'foo' }),
          examples: [{ code: 'foo()', title: 'Basic usage' }],
        },
      ];

      const result = await validateExamples(exports, {
        validations: ['presence'],
        packagePath: '/fake/path',
      });

      expect(result.presence!.withExamples).toBe(1);
    });

    test('handles multiple examples per export', async () => {
      const exports = [
        createDocumentedFunction('multi', {
          examples: ['example1()', 'example2()', 'example3()'],
        }),
      ];

      const result = await validateExamples(exports, {
        validations: ['presence'],
        packagePath: '/fake/path',
      });

      expect(result.presence!.withExamples).toBe(1);
    });
  });

  describe('validation results structure', () => {
    test('includes requested validations in result', async () => {
      const exports = [createExport({ name: 'foo' })];

      const result = await validateExamples(exports, {
        validations: ['presence'],
        packagePath: '/fake/path',
      });

      expect(result.validations).toContain('presence');
    });

    test('calculates total issues correctly', async () => {
      const exports = [
        createExport({ name: 'missing1' }),
        createExport({ name: 'missing2' }),
        createDocumentedFunction('has', { examples: ['x()'] }),
      ];

      const result = await validateExamples(exports, {
        validations: ['presence'],
        packagePath: '/fake/path',
      });

      expect(result.totalIssues).toBe(2); // 2 missing examples
    });
  });

  describe('typecheck validation structure', () => {
    test('creates typecheck result structure when enabled', async () => {
      // Exports with no examples to avoid actual typechecking
      const exports = [createExport({ name: 'noExamples' })];

      const result = await validateExamples(exports, {
        validations: ['typecheck'],
        packagePath: '/fake/path',
      });

      // With no examples, typecheck should just be empty
      expect(result.typecheck).toBeDefined();
      expect(result.typecheck!.passed).toBe(0);
      expect(result.typecheck!.failed).toBe(0);
      expect(result.typecheck!.errors).toHaveLength(0);
    });
  });

  describe('run validation structure', () => {
    test('creates run result structure when enabled with no examples', async () => {
      // Exports with no examples to avoid actual runtime
      const exports = [createExport({ name: 'noExamples' })];

      const result = await validateExamples(exports, {
        validations: ['run'],
        packagePath: '/fake/path',
      });

      // With no examples, run should just be empty
      expect(result.run).toBeDefined();
      expect(result.run!.passed).toBe(0);
      expect(result.run!.failed).toBe(0);
      expect(result.run!.skipped).toBe(0);
      expect(result.run!.drifts).toHaveLength(0);
      expect(result.run!.installSuccess).toBe(true);
    });
  });
});
