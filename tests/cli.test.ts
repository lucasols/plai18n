/* eslint-disable no-control-regex */
import { describe, expect, test } from 'vitest';

import { runCmd } from '@lucasols/utils/runShellCmd';
import { writeFileSync } from 'fs';
import path from 'path';

async function run({
  fixConfigs,
  defaultLocale,
}: {
  fixConfigs?: boolean;
  defaultLocale?: string;
} = {}) {
  const { out } = await runCmd(
    null,
    [
      'pnpm',
      'exec',
      'tsm',
      '--no-warnings',
      'src/cli.ts',
      '--config-dir',
      './cli-test/config',
      '--src-dir',
      './cli-test/src',
      '--no-color',
      fixConfigs ? '--fix' : '',
      defaultLocale ? `--default ${defaultLocale}` : '',
    ].filter(Boolean),
  );

  return out.replace(/[^a-zA-Z0-9 ,\n.]/g, '');
}

function updateConfigFiles({
  pt,
  en,
}: {
  pt: Record<string, any>;
  en: Record<string, any>;
}) {
  writeFileSync(
    path.join(process.cwd(), 'cli-test/config/pt.json'),
    JSON.stringify(pt, null, 2),
  );
  writeFileSync(
    path.join(process.cwd(), 'cli-test/config/en.json'),
    JSON.stringify(en, null, 2),
  );
}

describe('check for errors', () => {
  test('missing translations', async () => {
    updateConfigFiles({
      pt: {
        'Hello World': 'Olá Mundo',
      },
      en: {},
    });

    const out = await run();

    expect(out).toMatchInlineSnapshot(`
      " en.json has invalid translations missing 7,
       pt.json has invalid translations missing 6,
      "
    `);
  });
});
