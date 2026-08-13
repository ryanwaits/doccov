/**
 * Zod validation schema for Drift configuration.
 * Mirrors the CLI's drift.config.json shape (see drift.config.schema.json in
 * @driftdev/cli) — one config format, validated the same everywhere.
 */
import { z } from 'zod';
import type { DocsConfig, DriftConfig, ExamplesConfig } from './types';

const stringList: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodString>]> = z.union([
  z.string(),
  z.array(z.string()),
]);

const remoteDocsTargetSchema: z.ZodObject<{
  repo: z.ZodString;
  branch: z.ZodOptional<z.ZodString>;
}> = z.object({
  /** Target repo in "owner/repo" format */
  repo: z.string().regex(/^[^/]+\/[^/]+$/, 'must be in "owner/repo" format'),
  /** Target branch (defaults to repo's default branch) */
  branch: z.string().optional(),
});

/**
 * Docs configuration schema
 */
const docsConfigSchema: z.ZodObject<{
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  remote: z.ZodOptional<z.ZodArray<typeof remoteDocsTargetSchema>>;
}> = z.object({
  /** Glob patterns for markdown docs to include */
  include: stringList.optional(),
  /** Glob patterns for markdown docs to exclude */
  exclude: stringList.optional(),
  /** Remote repos to sync docs on breaking changes */
  remote: z.array(remoteDocsTargetSchema).optional(),
});

const coverageConfigSchema: z.ZodObject<{
  min: z.ZodOptional<z.ZodNumber>;
  ratchet: z.ZodOptional<z.ZodBoolean>;
}> = z.object({
  /** Minimum coverage % (exit 1 if below) */
  min: z.number().min(0).max(100).optional(),
  /** Ratchet: effective min = max(min, highest_ever) */
  ratchet: z.boolean().optional(),
});

const examplesConfigSchema: z.ZodObject<{
  run: z.ZodOptional<z.ZodBoolean>;
}> = z.object({
  /** Allow --run in non-TTY (CI) without --yes */
  run: z.boolean().optional(),
});

export const driftConfigSchema: z.ZodObject<{
  $schema: z.ZodOptional<z.ZodString>;
  entry: z.ZodOptional<z.ZodString>;
  include: z.ZodOptional<typeof stringList>;
  exclude: z.ZodOptional<typeof stringList>;
  coverage: z.ZodOptional<typeof coverageConfigSchema>;
  lint: z.ZodOptional<z.ZodBoolean>;
  docs: z.ZodOptional<typeof docsConfigSchema>;
  examples: z.ZodOptional<typeof examplesConfigSchema>;
}> = z.object({
  /** Editor/agent affordance — path or URL of drift.config.schema.json */
  $schema: z.string().optional(),
  /** Entry point override (otherwise auto-detected) */
  entry: z.string().optional(),
  include: stringList.optional(),
  exclude: stringList.optional(),
  /** Coverage thresholds */
  coverage: coverageConfigSchema.optional(),
  /** Enable lint checks (default true) */
  lint: z.boolean().optional(),
  /** Markdown documentation configuration */
  docs: docsConfigSchema.optional(),
  /** Example execution policy */
  examples: examplesConfigSchema.optional(),
});

export type DriftConfigInput = z.infer<typeof driftConfigSchema>;

const normalizeList = (value?: string | string[]): string[] | undefined => {
  if (!value) {
    return undefined;
  }

  const list = Array.isArray(value) ? value : [value];
  const normalized = list.map((item) => item.trim()).filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizeConfig = (input: DriftConfigInput): DriftConfig => {
  const include = normalizeList(input.include);
  const exclude = normalizeList(input.exclude);

  let docs: DocsConfig | undefined;
  if (input.docs) {
    const docsInclude = normalizeList(input.docs.include);
    const docsExclude = normalizeList(input.docs.exclude);
    if (docsInclude || docsExclude || input.docs.remote?.length) {
      docs = {
        include: docsInclude,
        exclude: docsExclude,
        remote: input.docs.remote?.length ? input.docs.remote : undefined,
      };
    }
  }

  let examples: ExamplesConfig | undefined;
  if (input.examples && input.examples.run !== undefined) {
    examples = { run: input.examples.run };
  }

  return {
    entry: input.entry,
    include,
    exclude,
    coverage: input.coverage,
    lint: input.lint,
    docs,
    examples,
  };
};
