import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function syncCompatibilityLocale(language) {
  const compatibilityPath = join(localesRoot, `${language}.json`);
  const domains = listLocaleDomains(language);
  const nextLocale = {};

  for (const domain of domains) {
    nextLocale[domain] = readJson(join(localesRoot, language, `${domain}.json`));
  }

  writeFileSync(compatibilityPath, `${JSON.stringify(nextLocale, null, 2)}\n`, 'utf8');
  return { compatibilityPath, domains: domains.length };
}

for (const language of supportedLanguages) {
  const result = syncCompatibilityLocale(language);
  console.log(`synced ${language} compatibility locale (${result.domains} domains) -> ${result.compatibilityPath}`);
}
