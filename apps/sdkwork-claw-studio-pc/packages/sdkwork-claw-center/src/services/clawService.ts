import { delay, type StudioInstanceRecord } from '@sdkwork/claw-types';
import { studio } from '@sdkwork/claw-infrastructure';
import {
  Code2,
  Headset,
  PenTool,
  Search,
  Sparkles,
  Workflow,
} from 'lucide-react';
import type {
  ClawRegistryCategory,
  ClawRegistryDetail,
  ClawRegistryEntry,
  ClawRegistryQuickConnectState,
} from '../types';
import {
  isRegistryGatewayReadyInstance,
  resolveRegistryQuickConnectAction,
  supportsRegistryQuickConnectInstance,
} from './clawRegistryPresentation.ts';

export interface IClawService {
  getRegistryEntries(): Promise<ClawRegistryEntry[]>;
  getRegistryDetail(id: string): Promise<ClawRegistryDetail | null>;
  getCategories(): Promise<ClawRegistryCategory[]>;
  getQuickConnectState(): Promise<ClawRegistryQuickConnectState>;
}

export const REGISTRY_CATEGORIES: ClawRegistryCategory[] = [
  {
    id: 'Engineering',
    name: 'Engineering',
    icon: Code2,
    desc: 'Code generation, review, delivery, and developer copilot services.',
  },
  {
    id: 'Research',
    name: 'Research',
    icon: Search,
    desc: 'Evidence gathering, retrieval, browsing, and structured analysis services.',
  },
  {
    id: 'Operations',
    name: 'Operations',
    icon: Workflow,
    desc: 'Runtime operations, incidents, scheduling, and production automation.',
  },
  {
    id: 'Support',
    name: 'Support',
    icon: Headset,
    desc: 'Intake, classification, escalation, and customer-facing response systems.',
  },
  {
    id: 'Content',
    name: 'Content',
    icon: PenTool,
    desc: 'Editorial, publishing, scripting, and narrative generation flows.',
  },
  {
    id: 'Automation',
    name: 'Automation',
    icon: Sparkles,
    desc: 'Registry coordinators, workflow agents, and ACP-first orchestration surfaces.',
  },
];

const REGISTRY_ENTRIES: ClawRegistryDetail[] = [
  {
    id: 'codex-routing-hub',
    slug: 'codex-routing-hub',
    name: 'Codex Routing Hub',
    kind: 'agent',
    category: 'Engineering',
    summary: 'Routes engineering tasks to code, review, and release specialists.',
    description:
      'A gateway-ready OpenClaw coordination entry that decomposes engineering work, selects specialists, and keeps delivery traceable.',
    tags: ['code', 'review', 'release', '\u591a\u667a\u80fd\u4f53'],
    capabilities: ['task routing', 'code review', 'release checkpoints', 'parallel work'],
    searchTerms: ['engineering', 'coding', '\u5f00\u53d1', '\u4ee3\u7801', 'review', 'routing'],
    verified: true,
    featured: true,
    matchCount: 12800,
    activeAgents: 1840,
    region: 'Global',
    latency: '<120ms',
    updatedAt: '2026-03-22T09:30:00.000Z',
    serviceModes: ['ACP', 'Gateway', 'Session routing'],
    bestFor: ['feature delivery', 'debugging', 'multi-agent engineering'],
    integrations: ['GitHub', 'GitLab', 'Jira'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/codex-routing-hub',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/codex-routing-hub',
      authMode: 'token',
      tokenPlaceholder: '<codex-routing-token>',
      defaultSession: 'agent:main:main',
      commandHint: 'Send this ACP command to an engineering agent so it can attach directly.',
    },
    owner: 'OpenClaw Verified',
    overview:
      'Codex Routing Hub is designed as an engineering matchmaker. It receives broad delivery goals, maps them into bounded tracks, then attaches the right OpenClaw specialists for implementation, review, and recovery.',
    trustHighlights: [
      'Verified routing profile',
      'ACP-native entry point',
      'Supports explicit session hand-off',
    ],
    matchingNotes: [
      'Best when a task needs decomposition before execution.',
      'Strong fit for repositories with review gates and parallel workers.',
      'Pairs well with browser and research agents for end-to-end delivery.',
    ],
    onboarding: [
      'Choose this entry when the target work is engineering-heavy.',
      'Copy the ACP command or launch quick networking locally.',
      'Attach a bounded task and let the hub route it to the right specialists.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/codex-routing-hub/console',
    relatedIds: ['browser-ops-bridge', 'workflow-autopilot'],
  },
  {
    id: 'research-scout-grid',
    slug: 'research-scout-grid',
    name: 'Research Scout Grid',
    kind: 'service',
    category: 'Research',
    summary: 'High-recall scouting network for evidence, competitors, and source-backed briefs.',
    description:
      'A registry subject for web research, structured source comparison, and traceable evidence synthesis across large result spaces.',
    tags: ['research', 'citations', '\u68c0\u7d22', '\u8bc1\u636e'],
    capabilities: ['web search', 'source comparison', 'briefing', 'evidence synthesis'],
    searchTerms: ['research', 'analysis', '\u7ade\u54c1', '\u68c0\u7d22', 'sources', 'citations'],
    verified: true,
    featured: true,
    matchCount: 9400,
    activeAgents: 1260,
    region: 'US / EU / APAC',
    latency: '<180ms',
    updatedAt: '2026-03-21T18:15:00.000Z',
    serviceModes: ['ACP', 'Gateway', 'Batch lookup'],
    bestFor: ['market scans', 'root-cause research', 'competitive analysis'],
    integrations: ['Web search', 'Docs', 'PDF ingestion'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/research-scout-grid',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/research-scout-grid',
      authMode: 'token',
      tokenPlaceholder: '<research-grid-token>',
      defaultSession: 'agent:research:main',
      commandHint: 'Use this when another agent needs direct source-backed lookup capacity.',
    },
    owner: 'OpenClaw Registry',
    overview:
      'Research Scout Grid exposes a discovery-oriented OpenClaw subject that specializes in breadth-first retrieval and evidence packaging. It is designed for queries where source quality matters more than raw speed.',
    trustHighlights: [
      'Registry-authored evidence profile',
      'Designed for source-backed output',
      'Strong fit for large search spaces',
    ],
    matchingNotes: [
      'Use it when the primary problem is uncertainty or lack of evidence.',
      'Strong fit for tasks that end in summaries, comparisons, or citations.',
      'Hand off results to engineering or operations entries when execution follows research.',
    ],
    onboarding: [
      'Search for the topic or capability you need.',
      'Open the detail page to inspect the matching profile.',
      'Copy the ACP command into the downstream agent session.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/research-scout-grid/console',
    relatedIds: ['codex-routing-hub', 'browser-ops-bridge'],
  },
  {
    id: 'ops-response-mesh',
    slug: 'ops-response-mesh',
    name: 'Ops Response Mesh',
    kind: 'agent',
    category: 'Operations',
    summary: 'Incident response, rollback planning, and runtime recovery coordination.',
    description:
      'An OpenClaw operations entry built for noisy production situations where containment, evidence, and explicit action sequencing matter.',
    tags: ['ops', 'incident', 'runtime', '\u8fd0\u7ef4'],
    capabilities: ['incident triage', 'rollback sequencing', 'runtime checks', 'escalation'],
    searchTerms: ['ops', 'incident', '\u6545\u969c', 'rollback', 'runtime', 'production'],
    verified: true,
    featured: false,
    matchCount: 8700,
    activeAgents: 1120,
    region: 'Global',
    latency: '<150ms',
    updatedAt: '2026-03-20T14:20:00.000Z',
    serviceModes: ['ACP', 'Session hand-off'],
    bestFor: ['incident response', 'runtime mitigation', 'ops triage'],
    integrations: ['PagerDuty', 'GitHub Actions', 'Logs'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/ops-response-mesh',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/ops-response-mesh',
      authMode: 'token',
      tokenPlaceholder: '<ops-mesh-token>',
      defaultSession: 'agent:ops:main',
      commandHint: 'Use this when a task needs operational containment before feature work.',
    },
    owner: 'OpenClaw Verified',
    overview:
      'Ops Response Mesh is optimized for runtime pressure. It favors evidence-first diagnosis, bounded mitigation, and explicit rollback criteria over open-ended exploration.',
    trustHighlights: [
      'Operations-focused system prompt',
      'Low-risk mitigation bias',
      'Good fit for production recovery workflows',
    ],
    matchingNotes: [
      'Best when a live service is already degraded or at risk.',
      'Use before larger refactors when stability is the immediate concern.',
      'Pairs well with Research Scout Grid when root cause is still unclear.',
    ],
    onboarding: [
      'Attach incident context and system state.',
      'Let the mesh classify the severity and containment path.',
      'Promote the result into an engineering follow-up if code changes are required.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/ops-response-mesh/console',
    relatedIds: ['workflow-autopilot', 'codex-routing-hub'],
  },
  {
    id: 'support-intake-center',
    slug: 'support-intake-center',
    name: 'Support Intake Center',
    kind: 'service',
    category: 'Support',
    summary: 'Classifies user issues, requests missing context, and routes cases cleanly.',
    description:
      'A support-oriented registry service for triage, intake hygiene, and escalation routing across large inbound queues.',
    tags: ['support', 'triage', '\u5ba2\u670d', 'intake'],
    capabilities: ['issue classification', 'context gathering', 'resolution routing'],
    searchTerms: ['support', 'ticket', '\u5de5\u5355', 'triage', 'customer'],
    verified: true,
    featured: false,
    matchCount: 7600,
    activeAgents: 980,
    region: 'Global',
    latency: '<140ms',
    updatedAt: '2026-03-19T11:40:00.000Z',
    serviceModes: ['ACP', 'Webhook', 'Queue dispatch'],
    bestFor: ['support ops', 'intake routing', 'case normalization'],
    integrations: ['Zendesk', 'Intercom', 'Email'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/support-intake-center',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/support-intake-center',
      authMode: 'token',
      tokenPlaceholder: '<support-intake-token>',
      defaultSession: 'agent:support:main',
      commandHint: 'Send this to a frontline agent when it should route rather than solve everything itself.',
    },
    owner: 'Registry Partner',
    overview:
      'Support Intake Center is a triage-first OpenClaw service. It keeps inbound support traffic structured so deeper agents receive clean, actionable context instead of raw user noise.',
    trustHighlights: [
      'Optimized for intake quality',
      'Good fit for human-plus-agent support desks',
      'Keeps routing logic explicit',
    ],
    matchingNotes: [
      'Use it at the front of a support or service workflow.',
      'Strong fit when current agents are overloaded by incomplete requests.',
      'Pairs well with engineering and operations entries downstream.',
    ],
    onboarding: [
      'Choose the service when support volume is large or messy.',
      'Copy the ACP command into the operator or bot that owns intake.',
      'Let it normalize the request before escalation.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/support-intake-center/console',
    relatedIds: ['ops-response-mesh'],
  },
  {
    id: 'content-studio-live',
    slug: 'content-studio-live',
    name: 'Content Studio Live',
    kind: 'service',
    category: 'Content',
    summary: 'Editorial and launch-content registry subject for structured multi-format output.',
    description:
      'Designed for release notes, documentation refreshes, launch assets, and narrative polishing with strong structure discipline.',
    tags: ['content', 'docs', '\u5199\u4f5c', 'launch'],
    capabilities: ['docs writing', 'release notes', 'messaging', 'editing'],
    searchTerms: ['content', 'docs', '\u6587\u6863', 'copywriting', 'launch'],
    verified: true,
    featured: false,
    matchCount: 6400,
    activeAgents: 720,
    region: 'Global',
    latency: '<160ms',
    updatedAt: '2026-03-22T07:10:00.000Z',
    serviceModes: ['ACP', 'Batch generation'],
    bestFor: ['docs refresh', 'launch copy', 'structured writing'],
    integrations: ['Markdown', 'Docs', 'Translation'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/content-studio-live',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/content-studio-live',
      authMode: 'token',
      tokenPlaceholder: '<content-studio-token>',
      defaultSession: 'agent:content:main',
      commandHint: 'Use this when a downstream agent needs polished publishing output.',
    },
    owner: 'Registry Partner',
    overview:
      'Content Studio Live acts as a structured editorial registry entry. It is tuned for consistency, clear framing, and multi-format publishing support instead of broad general chat.',
    trustHighlights: [
      'Publishing-oriented output',
      'Good for documentation and launch surfaces',
      'Works well after research or engineering inputs',
    ],
    matchingNotes: [
      'Best after requirements or implementation already exist.',
      'Strong fit for packaging work into user-facing artifacts.',
      'Avoid using it as the first stop for exploratory technical decisions.',
    ],
    onboarding: [
      'Feed it validated decisions or implementation notes.',
      'Select the format and publishing target.',
      'Let the service produce structured output for docs or release channels.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/content-studio-live/console',
    relatedIds: ['research-scout-grid'],
  },
  {
    id: 'workflow-autopilot',
    slug: 'workflow-autopilot',
    name: 'Workflow Autopilot',
    kind: 'agent',
    category: 'Automation',
    summary: 'Bridges scheduled workflows, session wakeups, and automated multi-agent loops.',
    description:
      'A registry coordinator focused on repeatable automation, trigger wiring, and long-running OpenClaw delivery loops.',
    tags: ['automation', 'cron', 'workflow', '\u81ea\u52a8\u5316'],
    capabilities: ['workflow orchestration', 'session wakeup', 'scheduled automation'],
    searchTerms: ['automation', 'cron', 'workflow', 'session', '\u81ea\u52a8\u5316'],
    verified: true,
    featured: true,
    matchCount: 9100,
    activeAgents: 1510,
    region: 'Global',
    latency: '<110ms',
    updatedAt: '2026-03-18T16:05:00.000Z',
    serviceModes: ['ACP', 'Cron', 'Task routing'],
    bestFor: ['scheduled work', 'ops automation', 'registry choreography'],
    integrations: ['Cron', 'Webhooks', 'Task queues'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/workflow-autopilot',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/workflow-autopilot',
      authMode: 'token',
      tokenPlaceholder: '<workflow-autopilot-token>',
      defaultSession: 'agent:automation:main',
      commandHint: 'Use this when another agent should join an existing scheduled automation loop.',
    },
    owner: 'OpenClaw Verified',
    overview:
      'Workflow Autopilot is the best fit when the user wants repeatable, session-aware automation rather than a one-off answer. It keeps timing, routing, and downstream execution aligned.',
    trustHighlights: [
      'Automation-first registry profile',
      'Designed for recurring execution',
      'Works well with operations and engineering agents',
    ],
    matchingNotes: [
      'Use it for recurring tasks, wake-up cycles, and multi-step handoffs.',
      'Best when the surrounding system already has stable inputs and outputs.',
      'Pairs with Codex Routing Hub for engineering automation loops.',
    ],
    onboarding: [
      'Decide which workflow or schedule owns the task.',
      'Copy the ACP command into the agent that should join the loop.',
      'Let Workflow Autopilot keep the session aligned over time.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/workflow-autopilot/console',
    relatedIds: ['ops-response-mesh', 'codex-routing-hub'],
  },
  {
    id: 'browser-ops-bridge',
    slug: 'browser-ops-bridge',
    name: 'Browser Ops Bridge',
    kind: 'service',
    category: 'Research',
    summary: 'Live browsing and environment inspection bridge for UI-heavy or docs-heavy workflows.',
    description:
      'A registry service that excels at browser-first verification, UI reading, documentation extraction, and web task support.',
    tags: ['browser', 'ui', 'docs', '\u7f51\u9875'],
    capabilities: ['browser navigation', 'ui inspection', 'docs extraction'],
    searchTerms: ['browser', '\u7f51\u9875', 'ui', 'docs', 'verification'],
    verified: false,
    featured: false,
    matchCount: 5200,
    activeAgents: 610,
    region: 'Global',
    latency: '<220ms',
    updatedAt: '2026-03-21T09:05:00.000Z',
    serviceModes: ['ACP', 'Browser session'],
    bestFor: ['ui analysis', 'docs verification', 'browser automation support'],
    integrations: ['Web UI', 'Playwright'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/browser-ops-bridge',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/browser-ops-bridge',
      authMode: 'token',
      tokenPlaceholder: '<browser-bridge-token>',
      defaultSession: 'agent:browser:main',
      commandHint: 'Use this when the target work depends on web pages or interactive UI state.',
    },
    owner: 'Registry Community',
    overview:
      'Browser Ops Bridge gives registry consumers a web-native subject for pages, docs, and interface verification. It is valuable when the work depends on what is currently rendered in a browser instead of static text alone.',
    trustHighlights: [
      'Good fit for web-heavy tasks',
      'Useful companion for engineering and research flows',
      'Community profile with broad interoperability',
    ],
    matchingNotes: [
      'Use it when a workflow needs rendered-page awareness.',
      'Best paired with a coordinating agent that already knows the surrounding goal.',
      'Community-owned, so validate trust requirements before sensitive use.',
    ],
    onboarding: [
      'Open the detail and inspect the connection profile.',
      'Use the ACP command in a browser-capable downstream agent.',
      'Hand the rendered-state findings back to the coordinating session.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/browser-ops-bridge/console',
    relatedIds: ['research-scout-grid', 'codex-routing-hub'],
  },
  {
    id: 'registry-liaison',
    slug: 'registry-liaison',
    name: 'Registry Liaison',
    kind: 'agent',
    category: 'Automation',
    summary: 'OpenClaw matchmaking concierge for finding the right subject and handing off context.',
    description:
      'A discovery-oriented coordination agent that helps users choose the right registry entry and packages context for hand-off.',
    tags: ['matchmaking', 'registry', '\u64ae\u5408', 'handoff'],
    capabilities: ['matchmaking', 'context packaging', 'handoff preparation'],
    searchTerms: ['registry', 'matchmaking', '\u64ae\u5408', 'handoff', 'discover'],
    verified: true,
    featured: false,
    matchCount: 4800,
    activeAgents: 430,
    region: 'Global',
    latency: '<130ms',
    updatedAt: '2026-03-17T08:45:00.000Z',
    serviceModes: ['ACP', 'Session routing'],
    bestFor: ['finding the right agent', 'handoff prep', 'registry discovery'],
    integrations: ['Registry search', 'ACP sessions'],
    connection: {
      gatewayUrl: 'https://registry.openclaw.dev/registry-liaison',
      websocketUrl: 'wss://registry.openclaw.dev/gateway/registry-liaison',
      authMode: 'token',
      tokenPlaceholder: '<registry-liaison-token>',
      defaultSession: 'agent:registry:main',
      commandHint: 'Use this as the first stop when the right registry target is still unclear.',
    },
    owner: 'OpenClaw Registry',
    overview:
      'Registry Liaison exists to solve the front-door problem: not knowing which subject or service to pick. It helps classify the goal, find the best fit, and hand off enough context so the downstream agent can start fast.',
    trustHighlights: [
      'Designed for registry discovery',
      'Useful as a front-door coordination layer',
      'Good pairing surface for copied ACP commands',
    ],
    matchingNotes: [
      'Use it when the user intent is broad or ambiguous.',
      'It is a coordination aid, not the deepest specialist itself.',
      'Best paired with one of the specialist entries after classification.',
    ],
    onboarding: [
      'Describe the target outcome in a sentence or two.',
      'Let Registry Liaison shortlist likely registry subjects.',
      'Attach the copied ACP command for the specialist it recommends.',
    ],
    docsUrl: 'https://openclaw.dev/docs/cli/acp',
    consoleUrl: 'https://registry.openclaw.dev/registry-liaison/console',
    relatedIds: ['codex-routing-hub', 'research-scout-grid', 'workflow-autopilot'],
  },
];

function mapQuickConnectCandidate(instance: StudioInstanceRecord) {
  return {
    id: instance.id,
    runtimeKind: instance.runtimeKind,
    status: instance.status,
    transportKind: instance.transportKind,
    baseUrl: instance.baseUrl ?? null,
    websocketUrl: instance.websocketUrl ?? null,
  };
}

function toRegistryEntry(detail: ClawRegistryDetail): ClawRegistryEntry {
  return {
    id: detail.id,
    slug: detail.slug,
    name: detail.name,
    kind: detail.kind,
    category: detail.category,
    summary: detail.summary,
    description: detail.description,
    tags: [...detail.tags],
    capabilities: [...detail.capabilities],
    searchTerms: [...detail.searchTerms],
    verified: detail.verified,
    featured: detail.featured,
    matchCount: detail.matchCount,
    activeAgents: detail.activeAgents,
    region: detail.region,
    latency: detail.latency,
    updatedAt: detail.updatedAt,
    serviceModes: [...detail.serviceModes],
    bestFor: [...detail.bestFor],
    integrations: [...detail.integrations],
    connection: { ...detail.connection },
  };
}

class ClawService implements IClawService {
  async getRegistryEntries(): Promise<ClawRegistryEntry[]> {
    await delay(120);
    return REGISTRY_ENTRIES.map(toRegistryEntry);
  }

  async getRegistryDetail(id: string): Promise<ClawRegistryDetail | null> {
    await delay(100);
    return REGISTRY_ENTRIES.find((entry) => entry.id === id) || null;
  }

  async getCategories(): Promise<ClawRegistryCategory[]> {
    await delay(60);
    return REGISTRY_CATEGORIES;
  }

  async getQuickConnectState(): Promise<ClawRegistryQuickConnectState> {
    const instances = await studio.listInstances().catch(() => []);
    const candidates = instances.map(mapQuickConnectCandidate);
    const quickConnectInstances = candidates.filter(supportsRegistryQuickConnectInstance);
    const gatewayReadyInstanceCount = quickConnectInstances.filter(
      isRegistryGatewayReadyInstance,
    ).length;
    const action = resolveRegistryQuickConnectAction(candidates);

    return {
      action,
      availableInstanceCount: quickConnectInstances.length,
      gatewayReadyInstanceCount,
      recommendedInstanceId: action.instanceId,
    };
  }
}

export const clawService = new ClawService();
