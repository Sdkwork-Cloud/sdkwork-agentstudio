import { lazy } from 'react';

const AgentMarketPage = lazy(() =>
  import('./pages/AgentMarket').then((module) => ({
    default: module.AgentMarket,
  })),
);

export function AgentMarket() {
  return <AgentMarketPage />;
}
