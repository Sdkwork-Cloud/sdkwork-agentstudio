import React from 'react';
import {
  InstanceDetailLlmProviderDialogs,
  type InstanceDetailLlmProviderDialogsProps,
} from './InstanceDetailLlmProviderDialogs.tsx';
import {
  InstanceDetailLlmProvidersSection,
  type InstanceDetailLlmProvidersSectionProps,
} from './InstanceDetailLlmProvidersSection.tsx';

interface InstanceDetailLlmProvidersWorkbenchSectionProps {
  sectionProps: InstanceDetailLlmProvidersSectionProps;
  dialogProps: InstanceDetailLlmProviderDialogsProps;
}

export function InstanceDetailLlmProvidersWorkbenchSection({
  sectionProps,
  dialogProps,
}: InstanceDetailLlmProvidersWorkbenchSectionProps) {
  return (
    <>
      <InstanceDetailLlmProvidersSection {...sectionProps} />
      <InstanceDetailLlmProviderDialogs {...dialogProps} />
    </>
  );
}
