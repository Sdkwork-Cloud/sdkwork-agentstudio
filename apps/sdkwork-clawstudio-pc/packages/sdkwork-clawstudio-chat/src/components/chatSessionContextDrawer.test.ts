import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function runTest(name: string, callback: () => void | Promise<void>) {
  return Promise.resolve()
    .then(callback)
    .then(() => {
      console.log(`ok - ${name}`);
    })
    .catch((error) => {
      console.error(`not ok - ${name}`);
      throw error;
    });
}

const source = readFileSync(new URL('./ChatSessionContextDrawer.tsx', import.meta.url), 'utf8');

await runTest(
  'ChatSessionContextDrawer clears stale search state when the drawer closes or a selector section becomes unavailable',
  () => {
    assert.match(source, /import React, \{ useEffect, useMemo, useRef, useState \} from 'react';/);
    assert.match(
      source,
      /useEffect\(\(\) => \{\s*if \(isOpen && showAgentSection\) \{\s*return;\s*\}\s*setAgentSearchQuery\(''\);\s*\}, \[isOpen, showAgentSection\]\);/s,
    );
    assert.match(
      source,
      /useEffect\(\(\) => \{\s*if \(isOpen && showSkillSection\) \{\s*return;\s*\}\s*setSkillSearchQuery\(''\);\s*\}, \[isOpen, showSkillSection\]\);/s,
    );
  },
);

await runTest(
  'ChatSessionContextDrawer keeps empty search states recoverable with an inline reset action',
  () => {
    assert.match(source, /const hasAgentSearchQuery = agentSearchQuery\.trim\(\)\.length > 0;/);
    assert.match(source, /const hasSkillSearchQuery = skillSearchQuery\.trim\(\)\.length > 0;/);
    assert.match(
      source,
      /hasAgentSearchQuery \? \(\s*<button[\s\S]*onClick=\{\(\) => setAgentSearchQuery\(''\)\}[\s\S]*\{t\('common\.reset'\)\}/s,
    );
    assert.match(
      source,
      /hasSkillSearchQuery \? \(\s*<button[\s\S]*onClick=\{\(\) => setSkillSearchQuery\(''\)\}[\s\S]*\{t\('common\.reset'\)\}/s,
    );
  },
);

await runTest(
  'ChatSessionContextDrawer clears stale search text after the agent or skill catalog changes underneath an open drawer',
  () => {
    assert.match(source, /import React, \{ useEffect, useMemo, useRef, useState \} from 'react';/);
    assert.match(source, /const previousAgentOptionsKeyRef = useRef<string \| null>\(null\);/);
    assert.match(source, /const previousSkillOptionsKeyRef = useRef<string \| null>\(null\);/);
    assert.match(source, /const agentOptionsKey = useMemo\(/);
    assert.match(source, /agentOptions\s*\.map\(\(option\) =>/s);
    assert.match(source, /\.join\('\|'\),\s*\[agentOptions\],/s);
    assert.match(source, /const skillOptionsKey = useMemo\(/);
    assert.match(source, /skillOptions\s*\.map\(\(option\) =>/s);
    assert.match(source, /\.join\('\|'\),\s*\[skillOptions\],/s);
    assert.match(
      source,
      /useEffect\(\(\) => \{\s*if \(!showAgentSection\) \{\s*previousAgentOptionsKeyRef\.current = agentOptionsKey;\s*return;\s*\}[\s\S]*if \(\s*!isOpen\s*\|\|\s*!hasAgentSearchQuery\s*\|\|\s*isAgentLoading\s*\|\|\s*!previousAgentOptionsKey\s*\|\|\s*previousAgentOptionsKey === agentOptionsKey\s*\|\|\s*filteredAgentOptions\.length > 0\s*\) \{\s*return;\s*\}\s*setAgentSearchQuery\(''\);\s*\}, \[agentOptionsKey, filteredAgentOptions\.length, hasAgentSearchQuery, isAgentLoading, isOpen, showAgentSection\]\);/s,
    );
    assert.match(
      source,
      /useEffect\(\(\) => \{\s*if \(!showSkillSection\) \{\s*previousSkillOptionsKeyRef\.current = skillOptionsKey;\s*return;\s*\}[\s\S]*if \(\s*!isOpen\s*\|\|\s*!hasSkillSearchQuery\s*\|\|\s*isSkillLoading\s*\|\|\s*!previousSkillOptionsKey\s*\|\|\s*previousSkillOptionsKey === skillOptionsKey\s*\|\|\s*filteredSkillOptions\.length > 0\s*\) \{\s*return;\s*\}\s*setSkillSearchQuery\(''\);\s*\}, \[hasSkillSearchQuery, isOpen, isSkillLoading, showSkillSection, skillOptionsKey, filteredSkillOptions\.length\]\);/s,
    );
  },
);
