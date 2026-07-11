import assert from 'node:assert/strict';
import {
  analyzeConfigSchema,
  coerceFormValues,
  matchesConfigNodeSearch,
  parseConfigSearchQuery,
  countSensitiveConfigValues,
  defaultConfigValue,
  deriveVisibleSchemaSections,
  hasSensitiveConfigData,
  removePathValue,
  renameObjectEntry,
  setPathValue,
  type JsonSchema,
} from './openClawConfigSchemaSupport.ts';

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
  'deriveVisibleSchemaSections keeps control-ui section order and preserves unknown sections',
  () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        channels: { type: 'object' },
        env: { type: 'object' },
        customSection: { type: 'object' },
        auth: { type: 'object' },
      },
    };

    const sections = deriveVisibleSchemaSections(schema);

    assert.deepEqual(
      sections.map((section) => ({
        key: section.key,
        label: section.label,
        category: section.category,
        isKnownSection: section.isKnownSection,
      })),
      [
        {
          key: 'env',
          label: 'Environment',
          category: 'core',
          isKnownSection: true,
        },
        {
          key: 'auth',
          label: 'Authentication',
          category: 'core',
          isKnownSection: true,
        },
        {
          key: 'channels',
          label: 'Channels',
          category: 'communication',
          isKnownSection: true,
        },
        {
          key: 'customSection',
          label: 'Custom Section',
          category: 'other',
          isKnownSection: false,
        },
      ],
    );
  },
);

await runTest(
  'config search matches nested labels, descriptions, and tags from schema hints',
  () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        update: {
          type: 'object',
          properties: {
            intervalHours: {
              type: 'integer',
              description: 'Polling interval for update checks',
            },
          },
        },
      },
    };

    const value = {
      update: {
        intervalHours: 12,
      },
    };

    assert.equal(
      matchesConfigNodeSearch({
        schema: schema.properties!.update!,
        value: value.update,
        path: ['update'],
        hints: {
          'update.intervalHours': {
            label: 'Check interval',
            tags: ['advanced', 'timing'],
          },
        },
        criteria: parseConfigSearchQuery('interval'),
      }),
      true,
    );

    assert.equal(
      matchesConfigNodeSearch({
        schema: schema.properties!.update!,
        value: value.update,
        path: ['update'],
        hints: {
          'update.intervalHours': {
            label: 'Check interval',
            tags: ['advanced', 'timing'],
          },
        },
        criteria: parseConfigSearchQuery('tag:advanced'),
      }),
      true,
    );

    assert.equal(
      matchesConfigNodeSearch({
        schema: schema.properties!.update!,
        value: value.update,
        path: ['update'],
        hints: {
          'update.intervalHours': {
            label: 'Check interval',
            tags: ['advanced', 'timing'],
          },
        },
        criteria: parseConfigSearchQuery('tag:security'),
      }),
      false,
    );
  },
);

await runTest(
  'analyzeConfigSchema normalizes nullable unions and coerceFormValues restores number and boolean types',
  () => {
    const analysis = analyzeConfigSchema({
      type: 'object',
      properties: {
        update: {
          type: 'object',
          properties: {
            enabled: {
              anyOf: [{ type: 'boolean' }, { type: 'null' }],
            },
            intervalHours: {
              type: 'integer',
            },
          },
        },
      },
    });

    assert.equal(analysis.unsupportedPaths.length, 0);

    const updateSchema = analysis.schema?.properties?.update;
    const coerced = coerceFormValues(
      {
        enabled: 'true',
        intervalHours: '12',
      },
      updateSchema as JsonSchema,
    ) as Record<string, unknown>;

    assert.deepEqual(coerced, {
      enabled: true,
      intervalHours: 12,
    });
  },
);

await runTest(
  'sensitive config helpers count real secrets but ignore env placeholder references',
  () => {
    const value = {
      apiKey: 'sk-live-123',
      nested: {
        token: '${TOKEN_FROM_ENV}',
        password: 'plain-secret',
      },
    };

    assert.equal(
      hasSensitiveConfigData(value, ['auth'], {
        'auth.apiKey': { sensitive: true },
      }),
      true,
    );
    assert.equal(
      countSensitiveConfigValues(value, ['auth'], {
        'auth.apiKey': { sensitive: true },
      }),
      2,
    );
  },
);

await runTest(
  'defaultConfigValue and path helpers support richer array and map editing flows',
  () => {
    assert.deepEqual(defaultConfigValue({ type: 'object' }), {});
    assert.deepEqual(defaultConfigValue({ type: 'array' }), []);
    assert.equal(defaultConfigValue({ type: 'boolean' }), false);
    assert.equal(defaultConfigValue({ type: 'integer' }), 0);
    assert.equal(defaultConfigValue({ type: 'string' }), '');

    const root: Record<string, unknown> = {};
    setPathValue(root, ['tools', 'entries', 0, 'id'], 'browser');
    setPathValue(root, ['tools', 'entries', 0, 'enabled'], true);
    setPathValue(root, ['env', 'OPENAI_API_KEY'], 'secret');

    assert.deepEqual(root, {
      tools: {
        entries: [
          {
            id: 'browser',
            enabled: true,
          },
        ],
      },
      env: {
        OPENAI_API_KEY: 'secret',
      },
    });

    assert.equal(renameObjectEntry(root, ['env'], 'OPENAI_API_KEY', 'OPENAI_KEY'), true);
    removePathValue(root, ['tools', 'entries', 0, 'enabled']);

    assert.deepEqual(root, {
      tools: {
        entries: [
          {
            id: 'browser',
          },
        ],
      },
      env: {
        OPENAI_KEY: 'secret',
      },
    });
  },
);
