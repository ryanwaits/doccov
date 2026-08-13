import type { ExampleValidationResult } from '@driftdev/sdk';
import { c, coverageColor, indent, progressBar } from '../utils/render';

export function renderExamples(data: ExampleValidationResult): string {
  const lines: string[] = [''];

  // Presence section
  if (data.presence) {
    const { total, withExamples, missing } = data.presence;
    const score = total > 0 ? Math.round((withExamples / total) * 100) : 100;
    const color = coverageColor(score);
    const bar = progressBar(score);

    lines.push(indent(`Examples  ${color(`${score}%`)}  ${bar}  (${withExamples}/${total})`));
    lines.push('');

    if (missing.length > 0) {
      lines.push(indent(c.gray('MISSING')));
      const shown = missing.slice(0, 15);
      for (const name of shown) {
        lines.push(indent(`  ${name}`));
      }
      const remaining = missing.length - shown.length;
      if (remaining > 0) {
        lines.push(indent(c.gray(`  ... +${remaining} more`)));
      }
      lines.push('');
    }
  }

  // Typecheck section
  if (data.typecheck) {
    const { passed, failed, errors } = data.typecheck;
    const status =
      failed === 0
        ? c.green(`${passed} passed`)
        : `${c.green(`${passed} passed`)}  ${c.red(`${failed} failed`)}`;
    lines.push(indent(`${c.gray('TYPECHECK')}  ${status}`));

    if (errors.length > 0) {
      const shown = errors.slice(0, 10);
      for (const err of shown) {
        const loc = err.error.line ? `, line ${err.error.line}` : '';
        lines.push(
          indent(
            `  ${c.red(err.exportName)} (example[${err.exampleIndex}]${loc}): ${err.error.message}`,
          ),
        );
      }
      const remaining = errors.length - shown.length;
      if (remaining > 0) {
        lines.push(indent(c.gray(`  ... +${remaining} more`)));
      }
    }
    lines.push('');
  }

  // Runtime section
  if (data.run) {
    const { passed, failed, skipped, drifts, installSuccess, installError } = data.run;

    if (!installSuccess) {
      lines.push(indent(`${c.gray('RUNTIME')}  ${c.red('failed')}`));
      if (installError) {
        lines.push(indent(`  ${c.red(installError)}`));
      }
    } else {
      const skipBit = skipped > 0 ? `  ${c.gray(`${skipped} skipped`)}` : '';
      const status =
        failed === 0
          ? `${c.green(`${passed} passed`)}${skipBit}`
          : `${c.green(`${passed} passed`)}  ${c.red(`${failed} failed`)}${skipBit}`;
      lines.push(indent(`${c.gray('RUNTIME')}  ${status}`));

      if (drifts.length > 0) {
        const shown = drifts.slice(0, 10);
        for (const drift of shown) {
          lines.push(indent(`  ${c.red(drift.exportName)}: ${drift.issue}`));
        }
        const remaining = drifts.length - shown.length;
        if (remaining > 0) {
          lines.push(indent(c.gray(`  ... +${remaining} more`)));
        }
      }
    }
    lines.push('');
  }

  // Tip
  const ran = data.validations;
  if (!ran.includes('typecheck') && !ran.includes('run')) {
    lines.push(indent(c.gray('Tip: drift examples --typecheck to compile-check examples')));
  } else if (!ran.includes('run')) {
    lines.push(
      indent(c.gray('Tip: drift examples --run to execute examples with // => assertions')),
    );
  }
  lines.push('');

  return lines.join('\n');
}
