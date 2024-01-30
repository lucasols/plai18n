import { invariant, isObject } from '@lucasols/utils/assertions';
import { consoleFmt as c } from '@lucasols/utils/consoleFmt';
import { joinStrings } from '@lucasols/utils/stringUtils';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import readdir from 'readdirp';
import { typeFlag } from 'type-flag';
import { getI18nUsagesInCode } from './findMissingTranslations.ts';

const parsed = typeFlag({
  'config-dir': {
    type: String,
    alias: 'c',
  },
  'src-dir': {
    type: String,
    alias: 'r',
  },
  default: {
    type: String,
    alias: 'd',
  },
  fix: {
    type: Boolean,
    alias: 'f',
    default: false,
  },
  'no-color': {
    type: Boolean,
    default: false,
  },
});

const allStringTranslationHashs = new Set<string>();
const allPluralTranslationHashs = new Set<string>();

let hasError = false;

const srcDir = parsed.flags['src-dir'];
invariant(srcDir, '--src-dir is required');

const configDir = parsed.flags['config-dir'];
invariant(configDir, '--config-dir is required');

const fixConfigs = parsed.flags.fix;
const defaultLocale = parsed.flags.default;
const noColor = parsed.flags['no-color'];

for await (const entry of readdir(path.join(process.cwd(), srcDir), {
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
  console.error('❌ No translations found in dir: ', srcDir);
  process.exit(1);
}

const missingTranslationsKey = '👇 missing translations 👇';
const missingTranslationValue = '🛑 delete this line 🛑';

for await (const entry of readdir(path.join(process.cwd(), configDir), {
  fileFilter: ['*.json'],
  directoryFilter: ['!node_modules', '.git'],
})) {
  const invalidPluralTranslations: string[] = [];

  const { fullPath, basename } = entry;

  const localeTranslations: Record<string, unknown> = JSON.parse(
    readFileSync(fullPath, 'utf-8'),
  );

  const isDefaultLocale = basename === `${defaultLocale}.json`;

  const localeFileHashs = Object.keys(localeTranslations);

  const extraHashs = new Set(localeFileHashs);
  const missingHashs = new Set([
    ...(isDefaultLocale ? [] : [...allStringTranslationHashs]),
    ...allPluralTranslationHashs,
  ]);

  extraHashs.delete('');

  for (const hash of localeFileHashs) {
    missingHashs.delete(hash);

    if (allStringTranslationHashs.has(hash)) {
      const isUnnededDefaultHash =
        isDefaultLocale && localeTranslations[hash] === null;

      if (!isUnnededDefaultHash) {
        extraHashs.delete(hash);
      }
    } else if (allPluralTranslationHashs.has(hash)) {
      extraHashs.delete(hash);

      if (
        localeTranslations[hash] !== undefined &&
        !isObject(localeTranslations[hash])
      ) {
        invalidPluralTranslations.push(hash);
        delete localeTranslations[hash];
        missingHashs.add(hash);
      }
    }
  }

  if (
    missingHashs.size > 0 ||
    extraHashs.size > 0 ||
    invalidPluralTranslations.length > 0
  ) {
    if (invalidPluralTranslations.length > 0) {
      console.error(
        `❌ ${basename} has invalid plural translations: `,
        invalidPluralTranslations,
      );
      hasError = true;
    }

    if (!fixConfigs) {
      hasError = true;

      if (missingHashs.size > 0 || extraHashs.size > 0) {
        console.error(
          joinStrings(
            `❌ ${basename} has invalid translations: `,
            [
              missingHashs.size ?
                `missing ${
                  noColor ?
                    missingHashs.size
                  : c.color('red', String(missingHashs.size))
                }`
              : '',
              extraHashs.size ?
                `extra ${
                  noColor ?
                    extraHashs.size
                  : c.color('red', String(extraHashs.size))
                }`
              : '',
            ].join(', '),
          ),
        );
      }
    } else {
      if (
        missingHashs.size === 0 &&
        extraHashs.size === 1 &&
        extraHashs.has(missingTranslationsKey)
      ) {
        console.error(`❌ ${basename} has missing translations`);
      } else {
        delete localeTranslations[''];

        if (
          !localeTranslations[missingTranslationsKey] &&
          missingHashs.size > 0
        ) {
          localeTranslations[missingTranslationsKey] = missingTranslationValue;
        }

        if (missingHashs.size > 0) {
          for (const hash of missingHashs) {
            localeTranslations[hash] =
              allPluralTranslationHashs.has(hash) ?
                {
                  zero: 'No x',
                  one: '1 x',
                  '+2': '# x',
                  many: 'A lot of x',
                  manyLimit: 50,
                }
              : null;
          }
        }

        if (extraHashs.size > 0) {
          for (const hash of extraHashs) {
            if (hash === missingTranslationsKey) continue;

            delete localeTranslations[hash];
          }
        }

        localeTranslations[''] = '';

        if (missingHashs.size > 0) {
          console.info(`🟠 ${basename} translations keys were added`);
        } else {
          console.info(`✅ ${basename} translations fixed`);
        }

        writeFileSync(fullPath, JSON.stringify(localeTranslations, null, 2));
      }
    }
  } else {
    console.info(`✅ ${basename} translations are up to date`);
  }
}

if (hasError) {
  process.exit(1);
}
