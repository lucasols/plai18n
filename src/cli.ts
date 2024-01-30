import { consoleFmt as c } from '@lucasols/utils/consoleFmt';
import { joinStrings } from '@lucasols/utils/stringUtils';
import { assertIsNotNullish } from '@lucasols/utils/assertions';
import { readFileSync } from 'fs';
import path from 'path';
import readdir from 'readdirp';
import { getI18nUsagesInCode } from './findMissingTranslations.ts';
import { typeFlag } from 'type-flag';

const parsed = typeFlag({
  'config-dir': {
    type: String,
    alias: 'c',
  },
  'root-dir': {
    type: String,
    alias: 'r',
  },
  fix: {
    type: Boolean,
    alias: 'f',
    default: false,
  },
});

const allStringTranslationHashs = new Set<string>();
const allPluralTranslationHashs = new Set<string>();

let hasError = false;

const rootDir = parsed.flags['root-dir'];
assertIsNotNullish(rootDir, '--root-dir is required');

const configDir = parsed.flags['config-dir'];
assertIsNotNullish(configDir, '--config-dir is required');

const fixConfigs = parsed.flags.fix;

for await (const entry of readdir(path.join(process.cwd(), rootDir), {
  fileFilter: ['*.ts', '*.tsx'],
  directoryFilter: ['!node_modules', '.git'],
})) {
  const { fullPath, basename } = entry;

  const fileTextContent = readFileSync(fullPath, 'utf-8');

  const i18nUsages = getI18nUsagesInCode(basename, fileTextContent);

  for (const hash of i18nUsages.stringTranslations) {
    allStringTranslationHashs.add(hash);
  }

  for (const hash of i18nUsages.pluralTranslations) {
    allPluralTranslationHashs.add(hash);
  }
}

if (
  allStringTranslationHashs.size === 0 &&
  allPluralTranslationHashs.size === 0
) {
  console.error('❌ No translations found in dir: ', rootDir);
  process.exit(1);
}

const missingTranslationsKey = '👇 missing translations 👇';
const missingTranslationValue = '🛑 delete this line 🛑';

for await (const entry of readdir(path.join(process.cwd(), configDir), {
  fileFilter: ['*.json'],
  directoryFilter: ['!node_modules', '.git'],
})) {
  const { fullPath, basename } = entry;

  const localeTranslations: Record<string, unknown> = JSON.parse(
    readFileSync(fullPath, 'utf-8'),
  );

  const localeFileHashs = Object.keys(localeTranslations);

  const extraHashs = new Set(localeFileHashs);
  const missingHashs = new Set([
    ...allStringTranslationHashs,
    ...allPluralTranslationHashs,
  ]);

  extraHashs.delete('');

  for (const hash of localeFileHashs) {
    missingHashs.delete(hash);

    if (allStringTranslationHashs.has(hash)) {
      extraHashs.delete(hash);
    } else if (allPluralTranslationHashs.has(hash)) {
      extraHashs.delete(hash);
    }
  }

  if (!fixConfigs) {
    if (missingHashs.size > 0 || extraHashs.size > 0) {
      hasError = true;

      console.error(
        joinStrings(
          `❌ ${basename} invalid translations: `,
          !!missingHashs.size &&
            `missing ${c.color('red', String(missingHashs.size))}`,
          !!extraHashs.size && [
            !!missingHashs.size && ', ',
            `extra ${c.color('red', String(extraHashs.size))}`,
          ],
        ),
      );
    }
  }
}

if (hasError) {
  process.exit(1);
}
