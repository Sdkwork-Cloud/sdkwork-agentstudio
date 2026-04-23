import assert from 'node:assert/strict';

import { resolveChatSidebarSessionActionsPresentation } from './chatSidebarSessionActionsPresentation.ts';

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
  'resolveChatSidebarSessionActionsPresentation keeps favorite and pin in the primary group and delete in a trailing danger group',
  () => {
    const presentation = resolveChatSidebarSessionActionsPresentation({
      isFavorited: false,
      pinOrigin: 'none',
      canDelete: true,
      labels: {
        favorite: 'Favorite',
        unfavorite: 'Remove favorite',
        pin: 'Pin',
        unpin: 'Unpin',
        delete: 'Delete',
      },
    });

    assert.deepEqual(
      presentation.sections.map((section) => ({
        id: section.id,
        itemIds: section.items.map((item) => item.id),
      })),
      [
        {
          id: 'primary',
          itemIds: ['favorite', 'pin'],
        },
        {
          id: 'danger',
          itemIds: ['delete'],
        },
      ],
    );
    assert.equal(presentation.sections[1]?.items[0]?.tone, 'danger');
  },
);

await runTest(
  'resolveChatSidebarSessionActionsPresentation flips toggle labels from the current state and disables pin changes for system-pinned sessions',
  () => {
    const presentation = resolveChatSidebarSessionActionsPresentation({
      isFavorited: true,
      pinOrigin: 'system',
      canDelete: false,
      labels: {
        favorite: 'Favorite',
        unfavorite: 'Remove favorite',
        pin: 'Pin',
        unpin: 'Unpin',
        delete: 'Delete',
      },
    });

    assert.equal(presentation.sections[0]?.items[0]?.label, 'Remove favorite');
    assert.equal(presentation.sections[0]?.items[1]?.label, 'Unpin');
    assert.equal(presentation.sections[0]?.items[1]?.disabled, true);
    assert.deepEqual(
      presentation.sections.find((section) => section.id === 'danger')?.items ?? [],
      [],
    );
  },
);
