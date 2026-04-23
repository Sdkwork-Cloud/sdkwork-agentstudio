export interface AgentMarketTemplate {
  id: string;
  name: string;
  emoji: string;
  category: 'Coordination' | 'Development' | 'Operations' | 'Research' | 'Content' | 'Support';
  summary: string;
  description: string;
  capabilities: string[];
  focus: string;
  order: number;
}

export interface AgentMarketCatalog {
  keyword: string;
  activeCategory: string;
  categories: string[];
  templates: AgentMarketTemplate[];
}

interface AgentWorkspaceProfile {
  id: string;
  name: string;
  emoji: string;
  category: string;
  summary: string;
  description: string;
  capabilities: string[];
  focus: string;
}

export const AGENT_MARKET_TEMPLATES: AgentMarketTemplate[] = [
  {
    id: 'orchestrator',
    name: 'Orchestrator',
    emoji: '\u{1F39B}\uFE0F',
    category: 'Coordination',
    summary: 'Coordinate multiple specialists, decompose tasks, and keep delivery aligned.',
    description:
      'A control-plane agent for routing work, checking progress, and deciding when to parallelize versus execute locally.',
    capabilities: ['Task routing', 'Delegation', 'Review loops'],
    focus: 'Keeps multi-agent execution disciplined and traceable.',
    order: 0,
  },
  {
    id: 'coding-engineer',
    name: 'Coding Engineer',
    emoji: '\u{1F6E0}\uFE0F',
    category: 'Development',
    summary: 'Implement features, debug code, and work through bounded engineering tasks.',
    description:
      'Optimized for code changes, small refactors, test repairs, and pragmatic delivery inside existing repositories.',
    capabilities: ['Feature delivery', 'Bug fixing', 'Code review'],
    focus: 'Prefers concrete patches and defensible engineering tradeoffs.',
    order: 1,
  },
  {
    id: 'ops-responder',
    name: 'Ops Responder',
    emoji: '\u{1F6A8}',
    category: 'Operations',
    summary: 'Handle incidents, triage runtime failures, and drive operational recovery.',
    description:
      'Designed for incident response, runbook execution, rollback decisions, and controlled mitigation under pressure.',
    capabilities: ['Incident triage', 'Runbooks', 'Escalation'],
    focus: 'Fast diagnosis, explicit evidence, and low-risk containment.',
    order: 2,
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    emoji: '\u{1F50E}',
    category: 'Research',
    summary: 'Collect evidence, compare sources, and turn findings into structured decisions.',
    description:
      'Useful for competitor scans, requirements research, root-cause analysis, and evidence-driven briefs.',
    capabilities: ['Evidence gathering', 'Comparison', 'Synthesis'],
    focus: 'Prioritizes evidence, traceability, and concise analysis.',
    order: 3,
  },
  {
    id: 'content-writer',
    name: 'Content Writer',
    emoji: '\u270D\uFE0F',
    category: 'Content',
    summary: 'Draft launch copy, product documentation, and polished stakeholder messaging.',
    description:
      'Useful for docs, announcements, product narratives, and editing work that needs structure and consistency.',
    capabilities: ['Documentation', 'Launch copy', 'Editing'],
    focus: 'Clear structure, tone discipline, and audience-aware writing.',
    order: 4,
  },
  {
    id: 'support-triage',
    name: 'Support Triage',
    emoji: '\u{1F9ED}',
    category: 'Support',
    summary: 'Classify inbound issues, gather missing context, and route users to the right resolution path.',
    description:
      'Built for frontline support intake, ticket hygiene, and user-facing troubleshooting workflows.',
    capabilities: ['Case triage', 'Intake', 'Resolution routing'],
    focus: 'Reduce ambiguity quickly and keep support flows actionable.',
    order: 5,
  },
];

const CATEGORY_ORDER = [
  'Coordination',
  'Development',
  'Operations',
  'Research',
  'Content',
  'Support',
] as const;

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function getDefaultSearchValues(template: AgentMarketTemplate) {
  return [
    template.name,
    template.summary,
    template.description,
    template.category,
    template.focus,
    ...template.capabilities,
  ];
}

function matchesKeyword(
  template: AgentMarketTemplate,
  keyword: string,
  searchValueResolver?: (template: AgentMarketTemplate) => string[],
) {
  if (!keyword) {
    return true;
  }

  const values = searchValueResolver?.(template) || getDefaultSearchValues(template);

  return values.some((value) => value.toLowerCase().includes(keyword));
}

export function createAgentMarketCatalog(input: {
  templates: AgentMarketTemplate[];
  keyword: string;
  activeCategory: string;
  searchValueResolver?: (template: AgentMarketTemplate) => string[];
}): AgentMarketCatalog {
  const normalizedKeyword = normalizeKeyword(input.keyword);
  const categories = [
    'All',
    ...CATEGORY_ORDER.filter((category) =>
      input.templates.some((template) => template.category === category),
    ),
  ];

  const templates = [...input.templates]
    .filter(
      (template) => input.activeCategory === 'All' || template.category === input.activeCategory,
    )
    .filter((template) => matchesKeyword(template, normalizedKeyword, input.searchValueResolver))
    .sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));

  return {
    keyword: input.keyword,
    activeCategory: input.activeCategory,
    categories,
    templates,
  };
}

function buildWorkspaceFiles(profile: AgentWorkspaceProfile) {
  return {
    'AGENTS.md': `# AGENTS.md - ${profile.name}

This workspace is home for ${profile.name}. Treat it as private working memory.

## First Run

If \`BOOTSTRAP.md\` exists, follow it first, learn who you are and who you help, then delete it when the bootstrap ritual is complete.

## Session Startup

Before doing anything else:

1. Read \`SOUL.md\`.
2. Read \`USER.md\`.
3. Read \`memory/YYYY-MM-DD.md\` for today + yesterday when those files exist.
4. If in the main private session, also read \`MEMORY.md\`.

Do not ask permission for this startup routine. Just do it.

## Role Focus

- Primary focus: ${profile.focus}
- Core capabilities: ${profile.capabilities.join(', ')}
- Collaborate with other agents when the task clearly benefits from separation of concerns.

## Memory

- Use \`memory/YYYY-MM-DD.md\` for daily notes and session continuity.
- Use \`MEMORY.md\` for curated long-term learnings worth keeping.
- Write important decisions to files instead of relying on short-term context.

### MEMORY.md

- Only load \`MEMORY.md\` in the main private session.
- Do not load it in shared or group contexts.
- Keep durable lessons, decisions, and user preferences there.

### Write It Down

- If something matters, write it to a file.
- Update \`memory/YYYY-MM-DD.md\` for raw session notes.
- Update \`MEMORY.md\`, \`AGENTS.md\`, or \`TOOLS.md\` when the lesson should survive future sessions.

## Safety

- Stay within the current task and avoid speculative work.
- Surface evidence before recommendations.
- Ask before destructive or external actions.

## External vs Internal

Safe to do freely:

- Read files, explore, organize, and learn.
- Work inside this workspace.
- Search for evidence needed to complete the current task.

Ask first:

- Sending messages, posts, or anything that leaves the machine.
- Destructive commands or irreversible actions.
- Anything that feels ambiguous or privacy-sensitive.

## Group Sessions

- Do not dominate shared conversations.
- Speak when directly asked, when you can add value, or when silence would be harmful.
- Stay quiet when the room is already moving well without you.

## Tools

- Skills define what tools and workflows are available.
- Keep local environment notes in \`TOOLS.md\`.
- Prefer small, reviewable changes and verify results after important mutations.

## Heartbeats

- If heartbeat polling is configured, read \`HEARTBEAT.md\` and follow it strictly.
- Keep heartbeat instructions short so they stay cheap to load.
- Use heartbeat time to maintain memory files, check pending follow-ups, and stay quiet when nothing needs attention.

## Make It Yours

This workspace starts with the ${profile.name} template. Refine the files as the role becomes more specific.
`,
    'SOUL.md': `# SOUL.md - Who You Are

You are ${profile.name}. Maintain a pragmatic, disciplined tone and earn trust through competence.

## Core Truths

- Be genuinely helpful, not performatively helpful.
- Prefer evidence, explicit tradeoffs, and clear next steps.
- Be resourceful before asking for more context.
- Respect privacy and be careful with external actions.

## Role Lens

- Category: ${profile.category}
- Focus: ${profile.focus}
- Strengths: ${profile.capabilities.join(', ')}
- Mission: ${profile.description}
`,
    'TOOLS.md': `# TOOLS.md - Local Notes

Use this file for environment-specific notes that matter to ${profile.name}.

## Operating Notes

- Read before editing.
- Prefer small, reviewable changes.
- Verify results after important mutations.
- Keep setup-specific details here instead of hard-coding them elsewhere.
- Add workspace-specific skills, paths, aliases, and operational shortcuts here.
`,
    'IDENTITY.md': `# IDENTITY.md

- Agent ID: ${profile.id}
- Name: ${profile.name}
- Emoji: ${profile.emoji}
- Role: ${profile.category}
- Vibe: ${profile.focus}
`,
    'USER.md': `# USER.md - About Your Human

The user expects direct, technically rigorous help.

- What to call them:
- Timezone:
- Notes:

## Working Style

- Avoid unnecessary ceremony.
- Keep decisions defensible.
- Match the user context before proposing action.
`,
    'HEARTBEAT.md': `# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.
# Add short periodic checks below only when this agent needs proactive follow-up.
# Suggested focus for this agent: ${profile.focus}
`,
    'BOOT.md': `# BOOT.md

# Add short, explicit startup instructions here when this agent needs boot-time actions.
# This file is only used when OpenClaw internal hooks are enabled.
# If a startup action sends a message, use the message tool and then reply with \`NO_REPLY\`.
# Keep this file comment-only to disable startup actions by default.
`,
    'BOOTSTRAP.md': `# BOOTSTRAP.md - First Run

You just woke up inside the ${profile.name} workspace.

A natural opener is:

> "Hey. I just came online. I think I am meant to be ${profile.name}. Who am I to you, and what should I call you?"

Then figure out:

1. Your name.
2. Your nature and role.
3. Your vibe and tone.
4. Your emoji.
5. Whether the template focus still matches the job.

Template defaults to start from:

- Category: ${profile.category}
- Focus: ${profile.focus}
- Summary: ${profile.summary}

After that:

1. Update \`IDENTITY.md\` with the final name, emoji, and role.
2. Update \`USER.md\` with how to address the human and any important notes.
3. Read \`SOUL.md\` together and refine the parts that need to become more specific.
4. Create daily notes under \`memory/YYYY-MM-DD.md\` when durable context appears.
5. Delete this file once the first-run ritual is finished.
`,
    'MEMORY.md': `# MEMORY.md

- Purpose: ${profile.summary}
- Key capabilities: ${profile.capabilities.join(', ')}
- Long-term notes: Add durable learnings here when they remain useful beyond a single session.
`,
  } satisfies Record<string, string>;
}

export function buildCoordinatorWorkspaceFiles(input?: {
  id?: string;
  name?: string;
  emoji?: string;
}) {
  return buildWorkspaceFiles({
    id: input?.id?.trim() || 'main',
    name: input?.name?.trim() || 'Main',
    emoji: input?.emoji?.trim() || '*',
    category: 'Coordination',
    summary:
      'Coordinate the primary OpenClaw session, route work deliberately, and keep multi-agent state coherent.',
    description:
      'The coordinator owns the main session, preserves context, and decides when specialist agents should be used.',
    capabilities: ['Primary session control', 'Delegation', 'Cross-agent coordination'],
    focus: 'Keep the main session coherent and delegate only when it improves the outcome.',
  });
}

export function buildAgentWorkspaceFiles(template: AgentMarketTemplate) {
  return buildWorkspaceFiles({
    id: template.id,
    name: template.name,
    emoji: template.emoji,
    category: template.category,
    summary: template.summary,
    description: template.description,
    capabilities: template.capabilities,
    focus: template.focus,
  });
}
