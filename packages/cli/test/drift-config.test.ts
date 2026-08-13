import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { mergeDefaults, validateConfig } from '../src/config/drift-config';
import { getProjectDir } from '../src/config/global';
import { computeRatchetMin } from '../src/utils/ratchet';

// --- Config validation ---

describe('config validation', () => {
  test('valid config', () => {
    const result = validateConfig({ coverage: { min: 80 } });
    expect(result.ok).toBe(true);
  });

  test('empty object → valid with defaults', () => {
    const result = validateConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.lint).toBe(true);
    }
  });

  test('invalid entry type', () => {
    const result = validateConfig({ entry: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain('"entry" must be a string');
  });

  test('coverage.min out of range', () => {
    const result = validateConfig({ coverage: { min: 200 } });
    expect(result.ok).toBe(false);
  });

  test('non-object → invalid', () => {
    expect(validateConfig('string').ok).toBe(false);
    expect(validateConfig(null).ok).toBe(false);
    expect(validateConfig([]).ok).toBe(false);
  });

  test('mergeDefaults sets lint=true', () => {
    const config = mergeDefaults({});
    expect(config.lint).toBe(true);
  });

  test('mergeDefaults preserves overrides', () => {
    const config = mergeDefaults({ lint: false, coverage: { min: 50 } });
    expect(config.lint).toBe(false);
    expect(config.coverage?.min).toBe(50);
  });

  test('examples.run boolean is valid', () => {
    const result = validateConfig({ examples: { run: true } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config.examples?.run).toBe(true);
  });

  test('examples.run non-boolean is invalid', () => {
    const result = validateConfig({ examples: { run: 'yes' } });
    expect(result.ok).toBe(false);
  });
});

// --- Ratcheting ---

describe('ratcheting', () => {
  const RATCHET_DIR = path.resolve(__dirname, 'fixtures/.tmp-ratchet');
  let projectDir: string;

  beforeEach(() => {
    // Ratchet now reads from ~/.drift/projects/<slug>/history.jsonl
    projectDir = getProjectDir(RATCHET_DIR);
    mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(projectDir)) rmSync(projectDir, { recursive: true });
    if (existsSync(RATCHET_DIR)) rmSync(RATCHET_DIR, { recursive: true });
  });

  test('no history → effectiveMin = configMin', () => {
    // Remove the project dir so no history file exists
    rmSync(projectDir, { recursive: true });
    const result = computeRatchetMin(50, RATCHET_DIR);
    expect(result.effectiveMin).toBe(50);
    expect(result.watermark).toBeNull();
  });

  test('history watermark raises min', () => {
    writeFileSync(
      path.join(projectDir, 'history.jsonl'),
      [
        JSON.stringify({ date: '2026-01-01', coverage: 70, exports: 10 }),
        JSON.stringify({ date: '2026-01-15', coverage: 85, exports: 12 }),
        JSON.stringify({ date: '2026-02-01', coverage: 80, exports: 12 }),
      ].join('\n'),
    );

    const result = computeRatchetMin(50, RATCHET_DIR);
    expect(result.effectiveMin).toBe(85);
    expect(result.watermark).toBe(85);
    expect(result.watermarkDate).toBe('2026-01-15');
  });

  test('configMin higher than watermark → uses configMin', () => {
    writeFileSync(
      path.join(projectDir, 'history.jsonl'),
      JSON.stringify({ date: '2026-01-01', coverage: 30, exports: 5 }),
    );

    const result = computeRatchetMin(80, RATCHET_DIR);
    expect(result.effectiveMin).toBe(80);
    expect(result.watermark).toBe(30);
  });

  test('malformed lines skipped', () => {
    writeFileSync(
      path.join(projectDir, 'history.jsonl'),
      [
        'not json',
        JSON.stringify({ date: '2026-01-01', coverage: 60, exports: 5 }),
        '{ broken',
      ].join('\n'),
    );

    const result = computeRatchetMin(40, RATCHET_DIR);
    expect(result.effectiveMin).toBe(60);
  });
});
