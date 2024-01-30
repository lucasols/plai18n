type Locale = Record<
  string,
  | string
  | null
  | {
      manyLimit?: number;
      zero?: string;
      one?: string;
      '+2'?: string;
      many?: string;
    }
>;

type I18nOptions<T extends string> = {
  locales: Record<T, Locale>;
};

let config: I18nOptions<string> | null = null;

export function i18nitialize<T extends string>(options: I18nOptions<T>) {
  config = options;

  return {
    with(localeId: T) {
      return new I18n(localeId);
    },
  };
}

class I18n {
  constructor(private localeId: string) {}

  createHashAndFallbackTranslation(
    strings: TemplateStringsArray,
    exprs: any[],
  ) {
    let hash = '';
    let fallbackTranslation = '';

    for (let i = 0; i < strings.length; i++) {
      const string = strings[i];
      const expr = exprs[i];

      hash += string + (i !== strings.length - 1 ? `{${i + 1}}` : '');
      fallbackTranslation += string + (expr ?? '');
    }

    if (fallbackTranslation.includes('~~')) {
      fallbackTranslation = fallbackTranslation.split('~~')[0]!;
    }

    return [hash, fallbackTranslation] as const;
  }

  __ = (strings: TemplateStringsArray, ...exprs: any[]): string => {
    const [hash, fallbackTranslation] = this.createHashAndFallbackTranslation(
      strings,
      exprs,
    );

    const activeLocale = config?.locales[this.localeId];

    if (!activeLocale) {
      throw new Error('No active locale');
    }

    const selectedTranslation = activeLocale[hash];

    if (selectedTranslation === undefined) {
      return fallbackTranslation;
    }

    if (typeof selectedTranslation === 'string' && selectedTranslation) {
      if (exprs.length === 0) {
        return selectedTranslation;
      }

      let translation = '';
      const translationParts = selectedTranslation.split(/{(\d+)}/);

      for (let i = 0; i < translationParts.length; i++) {
        const part = translationParts[i];

        if (i % 2 === 0) {
          translation += part;
        } else {
          const intepolationPos = Number(part);

          translation += exprs[intepolationPos - 1];
        }
      }

      return translation || fallbackTranslation;
    }

    if (selectedTranslation) {
      throw new Error(
        'Invalid translation, this translation should use the plural `__p` method',
      );
    }

    return fallbackTranslation;
  };

  __p = (num: number) => {
    return (strings: TemplateStringsArray, ...exprs: any[]) => {
      const [hash, fallbackTranslation] = this.createHashAndFallbackTranslation(
        strings,
        exprs,
      );

      const activeLocale = config?.locales[this.localeId];

      if (!activeLocale) {
        throw new Error('No active locale');
      }

      const selectedTranslation = activeLocale[hash];

      if (selectedTranslation === undefined) {
        return fallbackTranslation;
      }

      if (
        typeof selectedTranslation === 'object' &&
        selectedTranslation !== null
      ) {
        let translation = '';

        if (num === 0 && selectedTranslation.zero) {
          translation = selectedTranslation.zero;
        } else if (num === 1 && selectedTranslation.one) {
          translation = selectedTranslation.one;
        } else if (
          selectedTranslation.manyLimit &&
          selectedTranslation.many &&
          num > selectedTranslation.manyLimit
        ) {
          translation = selectedTranslation.many;
        } else if (selectedTranslation['+2']) {
          translation = selectedTranslation['+2'].replace('#', String(num));
        } else {
          console.error(`No plural configured for hash: ${hash}`);
        }

        if (exprs.length === 0) {
          return translation;
        }

        let interpolatedTranslation = '';
        const translationParts = translation.split(/{(\d+)}/);

        for (let i = 0; i < translationParts.length; i++) {
          const part = translationParts[i];

          if (i % 2 === 0) {
            interpolatedTranslation += part;
          } else {
            const intepolationPos = Number(part);

            interpolatedTranslation += exprs[intepolationPos - 1];
          }
        }

        return interpolatedTranslation || fallbackTranslation;
      }

      if (selectedTranslation) {
        throw new Error(
          'Invalid translation, this translation should use the `__` method',
        );
      }

      return fallbackTranslation;
    };
  };
}
