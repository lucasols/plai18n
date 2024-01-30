/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import ts from 'typescript';

function getHashFromTemplate(template: ts.TemplateLiteral) {
  if (ts.isNoSubstitutionTemplateLiteral(template)) {
    return template.text;
  }

  if (ts.isTemplateExpression(template)) {
    let hash = '';

    hash += template.head.text;

    template.templateSpans.forEach((span, i) => {
      hash += `{${i + 1}}${span.literal.text}`;
    });

    return hash;
  }

  return null;
}

export function getI18nUsagesInCode(
  fileName: string,
  code: string,
): {
  pluralTranslations: string[];
  stringTranslations: string[];
} {
  const checkFile =
    code.includes('i18n') || code.includes('__`') || code.includes('__p(');

  if (!checkFile) {
    return {
      pluralTranslations: [],
      stringTranslations: [],
    };
  }

  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    undefined,
    ts.ScriptKind.TSX,
  );

  const pluralTranslations = new Set<string>();
  const stringTranslations = new Set<string>();

  function checkNode(node: ts.Node) {
    if (ts.isTaggedTemplateExpression(node)) {
      const tteNode = node;

      if (
        (ts.isIdentifier(tteNode.tag) && tteNode.tag.escapedText === '___') ||
        (ts.isPropertyAccessExpression(tteNode.tag) &&
          tteNode.tag.name.escapedText === '___')
      ) {
        const template = tteNode.template;

        const hash = getHashFromTemplate(template);

        if (hash) stringTranslations.add(hash);
      }
      //
      else if (ts.isCallExpression(tteNode.tag)) {
        if (
          (ts.isIdentifier(tteNode.tag.expression) &&
            tteNode.tag.expression.escapedText === '___p') ||
          (ts.isPropertyAccessExpression(tteNode.tag.expression) &&
            tteNode.tag.expression.name.escapedText === '___p')
        ) {
          const hash = getHashFromTemplate(tteNode.template);

          if (hash) pluralTranslations.add(hash);
        }
      }
    }

    ts.forEachChild(node, checkNode);
  }

  checkNode(sourceFile);

  return {
    pluralTranslations: Array.from(pluralTranslations),
    stringTranslations: Array.from(stringTranslations),
  };
}
