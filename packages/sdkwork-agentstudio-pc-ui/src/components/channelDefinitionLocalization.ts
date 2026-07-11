type Translate = (key: string, options?: Record<string, unknown>) => string;

interface LocalizableChannelField {
  key: string;
  label: string;
  placeholder: string;
  helpText?: string;
}

interface LocalizableChannelItem<Field extends LocalizableChannelField = LocalizableChannelField> {
  id: string;
  name: string;
  description: string;
  setupSteps?: string[];
  fields?: Field[];
}

interface LocalizableChannelOfficialLink {
  href: string;
  label: string;
}

interface LocalizeChannelWorkspaceItemOptions {
  localizeMetadata?: boolean;
}

function resolveTranslatedText(
  t: Translate,
  keys: string[],
  fallback: string,
  options?: Record<string, unknown>,
) {
  for (const key of keys) {
    const translated = t(key, options);
    if (translated !== key) {
      return translated;
    }
  }

  return fallback;
}

function buildFieldTranslationKeys(
  channelId: string,
  fieldKey: string,
  textKey: 'label' | 'placeholder' | 'helpText',
) {
  return [
    `channels.definitions.channels.${channelId}.fields.${fieldKey}.${textKey}`,
    `channels.definitions.sharedFields.${fieldKey}.${textKey}`,
  ];
}

export function localizeChannelOfficialLink<T extends LocalizableChannelOfficialLink>(
  t: Translate,
  channelId: string,
  link: T | null,
) {
  if (!link) {
    return null;
  }

  return {
    ...link,
    label: resolveTranslatedText(
      t,
      [`channels.definitions.officialLinks.${channelId}`],
      link.label,
    ),
  } as T;
}

export function localizeChannelWorkspaceItem<T extends LocalizableChannelItem>(
  t: Translate,
  item: T,
  options: LocalizeChannelWorkspaceItemOptions = {},
) {
  const { localizeMetadata = true } = options;

  return {
    ...item,
    name: localizeMetadata
      ? resolveTranslatedText(
          t,
          [`channels.definitions.channels.${item.id}.name`],
          item.name,
        )
      : item.name,
    description: localizeMetadata
      ? resolveTranslatedText(
          t,
          [`channels.definitions.channels.${item.id}.description`],
          item.description,
        )
      : item.description,
    setupSteps: localizeMetadata
      ? item.setupSteps?.map((step, index) =>
          resolveTranslatedText(
            t,
            [`channels.definitions.channels.${item.id}.setupSteps.${index}`],
            step,
          ),
        )
      : item.setupSteps,
    fields: item.fields?.map((field) => {
      const helpText = resolveTranslatedText(
        t,
        buildFieldTranslationKeys(item.id, field.key, 'helpText'),
        field.helpText || '',
      );

      return {
        ...field,
        label: resolveTranslatedText(
          t,
          buildFieldTranslationKeys(item.id, field.key, 'label'),
          field.label,
        ),
        placeholder: resolveTranslatedText(
          t,
          buildFieldTranslationKeys(item.id, field.key, 'placeholder'),
          field.placeholder,
        ),
        helpText: helpText || undefined,
      };
    }),
  } as T;
}
