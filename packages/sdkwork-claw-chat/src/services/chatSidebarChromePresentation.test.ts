import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveChatSidebarChromePresentation } from './chatSidebarChromePresentation.ts';

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

await runTest(
  'resolveChatSidebarChromePresentation builds stable title keys and chrome visibility flags',
  () => {
    const presentation = resolveChatSidebarChromePresentation({
      agentRailItemCount: 2,
      historySections: [
        {
          id: 'today',
          label: 'Today',
        },
        {
          id: 'older',
          label: 'Older',
        },
      ],
      totalHistoryItems: 4,
    });

    assert.equal(presentation.showAgentRail, true);
    assert.equal(presentation.showEmptyState, false);
    assert.deepEqual(
      presentation.sections.map((entry) => ({
        id: entry.section.id,
        titleKey: entry.titleKey,
      })),
      [
        {
          id: 'today',
          titleKey: 'chat.sidebar.today',
        },
        {
          id: 'older',
          titleKey: 'chat.sidebar.older',
        },
      ],
    );
  },
);

await runTest(
  'resolveChatSidebarChromePresentation exposes the empty state when there is no sidebar history',
  () => {
    const presentation = resolveChatSidebarChromePresentation({
      agentRailItemCount: 0,
      historySections: [],
      totalHistoryItems: 0,
    });

    assert.equal(presentation.showAgentRail, false);
    assert.equal(presentation.showEmptyState, true);
    assert.deepEqual(presentation.sections, []);
  },
);

await runTest(
  'chatSidebarChromePresentation keeps section title mapping inside the dedicated chrome service',
  () => {
    const source = readFileSync(new URL('./chatSidebarChromePresentation.ts', import.meta.url), 'utf8');

    assert.match(
      source,
      /const sectionTitleKeyById: Record<ChatSidebarHistorySectionId, string> = \{/,
    );
    assert.match(source, /showAgentRail: params\.agentRailItemCount > 0,/);
    assert.match(source, /showEmptyState: params\.totalHistoryItems === 0,/);
    assert.doesNotMatch(source, /useTranslation/);
  },
);
