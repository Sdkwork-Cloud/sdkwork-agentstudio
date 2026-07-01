import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(currentDirectory, '..');
const localesRoot = join(packageRoot, 'src', 'locales');
const supportedLanguages = ['en', 'zh'];

function listLocaleDomains(language) {
  const languageDirectory = join(localesRoot, language);
  if (!existsSync(languageDirectory)) {
    return [];
  }

  return readdirSync(languageDirectory)
    .filter((entry) => extname(entry) === '.json')
    .map((entry) => entry.slice(0, -'.json'.length))
    .sort();
}

function validateLocaleIndex(language, domains, issues) {
  const indexPath = join(localesRoot, language, 'index.ts');
  if (!existsSync(indexPath)) {
    issues.push(`missing locale index: ${indexPath}`);
    return;
  }

  const source = readFileSync(indexPath, 'utf8');
  for (const domain of domains) {
    const importLine = `import ${domain} from './${domain}.json' with { type: 'json' };`;
    if (!source.includes(importLine)) {
      issues.push(`missing import for ${language}/${domain}.json in ${indexPath}`);
    }

    const objectEntry = `  ${domain},`;
    if (!source.includes(objectEntry)) {
      issues.push(`missing locale export entry for ${language}/${domain}.json in ${indexPath}`);
    }
  }
}

function validateCompatibilityLocale(language, domains, issues) {
  const compatibilityPath = join(localesRoot, `${language}.json`);
  if (!existsSync(compatibilityPath)) {
    issues.push(`missing compatibility locale file: ${compatibilityPath}`);
    return;
  }

  let locale;
  try {
    locale = JSON.parse(readFileSync(compatibilityPath, 'utf8'));
  } catch (error) {
    issues.push(`invalid JSON in compatibility locale file: ${compatibilityPath}`);
    return;
  }

  for (const domain of domains) {
    if (!(domain in locale)) {
      issues.push(`missing compatibility locale entry for ${language}/${domain}.json in ${compatibilityPath}`);
      continue;
    }

    const domainPath = join(localesRoot, language, `${domain}.json`);
    let domainLocale;
    try {
      domainLocale = JSON.parse(readFileSync(domainPath, 'utf8'));
    } catch (error) {
      issues.push(`invalid JSON in locale domain file: ${domainPath}`);
      continue;
    }

    if (!isDeepStrictEqual(locale[domain], domainLocale)) {
      issues.push(
        `compatibility locale entry for ${language}/${domain}.json is out of sync with ${compatibilityPath}; run pnpm --filter @sdkwork/claw-i18n sync:locales`,
      );
    }
  }
}

export function validateLocaleStructure() {
  const issues = [];

  const domainMatrix = new Map();
  for (const language of supportedLanguages) {
    const languageDirectory = join(localesRoot, language);
    if (!existsSync(languageDirectory)) {
      issues.push(`missing language directory: ${languageDirectory}`);
      continue;
    }

    const domains = listLocaleDomains(language);
    if (domains.length === 0) {
      issues.push(`no locale domain files found under ${languageDirectory}`);
      continue;
    }

    domainMatrix.set(language, domains);
    validateLocaleIndex(language, domains, issues);
    validateCompatibilityLocale(language, domains, issues);
  }

  const englishDomains = domainMatrix.get('en') || [];
  const chineseDomains = domainMatrix.get('zh') || [];
  if (englishDomains.join('|') !== chineseDomains.join('|')) {
    issues.push('english and chinese locale domain file sets are not aligned');
  }

  return issues.length === 0
    ? { ok: true, message: 'locale structure ok' }
    : { ok: false, message: `locale structure invalid:\n- ${issues.join('\n- ')}` };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === fileURLToPath(import.meta.url)) {
  const result = validateLocaleStructure();
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(result.message);
    process.exitCode = 1;
  }
}
