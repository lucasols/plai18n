import { dedent } from '@ls-stack/utils/dedent';
import { joinStrings } from '@ls-stack/utils/stringUtils';
import { expect, test } from 'vitest';
import { getI18nUsagesInCode } from '../src/findMissingTranslations.js';

test('find destructured usage of __', () => {
  const i18nUsages = getI18nUsagesInCode(
    'test.ts',
    dedent`
      import { i18n } from './i18n';

      const { __ } = i18n.with('pt');

      console.log(__\`hello\`);
    `,
  );

  expect(i18nUsages.stringTranslations).toMatchInlineSnapshot(`
    [
      "hello",
    ]
  `);
});

test('find destructured usage of __p', () => {
  const i18nUsages = getI18nUsagesInCode(
    'test.ts',
    dedent`
      import { i18n } from './i18n';

      const { __p } = i18n.with('pt');

      console.log(__p(2)\`hello\`);
    `,
  );

  expect(i18nUsages.pluralTranslations).toMatchInlineSnapshot(`
    [
      "hello",
    ]
  `);
});

test('find usage of __ with interpolation', () => {
  const i18nUsages = getI18nUsagesInCode(
    'test.ts',
    dedent`
      import { __ } from './i18n';

      ${'console.log(__`hello ${name}`);'}

      ${'console.log(__`hello ${name} ${age}`);'}
    `,
  );

  expect(i18nUsages.stringTranslations).toMatchInlineSnapshot(`
    [
      "hello {1}",
      "hello {1} {2}",
    ]
  `);
});

test('find usage of __p with interpolation', () => {
  const i18nUsages = getI18nUsagesInCode(
    'test.ts',
    dedent`
      import { __p } from './i18n';

      ${'console.log(__p(2)`hello ${name}`);'}

      ${'console.log(__p(2)`hello ${name} ${age}`);'}
    `,
  );

  expect(i18nUsages.pluralTranslations).toMatchInlineSnapshot(`
    [
      "hello {1}",
      "hello {1} {2}",
    ]
  `);
});

test('find usage of __ as method', () => {
  const i18nUsages = getI18nUsagesInCode(
    'test.ts',
    joinStrings(
      [
        "import { i18n } from './i18n';",
        '',
        "i18n.with('pt').__`hello`;",
        "i18n.with('pt').__`hello ${name}`;",

        'i18n.__`hello 2`;',
        'i18n.__`hello ${name} 2`;',
      ].join('\n'),
    ),
  );

  expect(i18nUsages.stringTranslations).toMatchInlineSnapshot(`
    [
      "hello",
      "hello {1}",
      "hello 2",
      "hello {1} 2",
    ]
  `);
});

test('find usage of __p as method', () => {
  const i18nUsages = getI18nUsagesInCode(
    'test.ts',
    joinStrings(
      [
        "import { i18n } from './i18n';",
        '',
        "i18n.with('pt').__p(2)`hello`;",
        "i18n.with('pt').__p(2)`hello ${name}`;",

        'i18n.__p(2)`hello 2`;',
        'i18n.__p(2)`hello ${name} 2`;',
      ].join('\n'),
    ),
  );

  expect(i18nUsages.pluralTranslations).toMatchInlineSnapshot(`
    [
      "hello",
      "hello {1}",
      "hello 2",
      "hello {1} 2",
    ]
  `);
});
