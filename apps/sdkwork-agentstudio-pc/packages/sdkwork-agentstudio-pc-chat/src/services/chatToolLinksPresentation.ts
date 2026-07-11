import type { OpenClawToolCard } from './openClawMessagePresentation.ts';

export interface PresentOpenClawToolLinkItemsInput {
  toolCards: OpenClawToolCard[];
  labels: {
    call: string;
    result: string;
  };
}

export type OpenClawToolLinkItem = OpenClawToolCard & {
  id: string;
  label: string;
  typeLabel: string;
};

function normalizeToolName(value: string | null | undefined) {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Tool';
}

function resolveToolLinkItemId(params: {
  toolCallId?: string;
  kind: OpenClawToolCard['kind'];
  toolName: string;
  index: number;
}) {
  const toolCallId = params.toolCallId?.trim();
  const baseId = toolCallId || `${params.kind}:${params.toolName}`;
  return `${baseId}:${params.kind}:${params.index}`;
}

export function presentOpenClawToolLinkItems({
  toolCards,
  labels,
}: PresentOpenClawToolLinkItemsInput): OpenClawToolLinkItem[] {
  const occurrenceByName = new Map<string, number>();

  return toolCards.map((toolCard, index) => {
    const toolName = normalizeToolName(toolCard.name);
    const occurrence = (occurrenceByName.get(toolName) ?? 0) + 1;
    occurrenceByName.set(toolName, occurrence);

    return {
      ...toolCard,
      id: resolveToolLinkItemId({
        toolCallId: toolCard.toolCallId,
        kind: toolCard.kind,
        toolName,
        index,
      }),
      label: occurrence > 1 ? `${toolName} ${occurrence}` : toolName,
      typeLabel: toolCard.kind === 'call' ? labels.call : labels.result,
    };
  });
}
