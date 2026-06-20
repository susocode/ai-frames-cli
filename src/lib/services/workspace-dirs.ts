export const BASE_DIRS = [
  '.aicontext',
  '.aicontext/rules',
  '.aicontext/agents',
  '.aicontext/skills',
  '.aicontext/prompts',
  '.aicontext/mcps',
  '.aicontext/contexts',
  '.aicontext/templates',
]

export const ASSISTANT_DIRS: Record<string, { aicontext: string[]; native: string[] }> = {
  claude: {
    aicontext: ['.aicontext/rules/.claude', '.aicontext/agents/.claude', '.aicontext/skills/.claude', '.aicontext/prompts/.claude'],
    native: ['.claude', '.claude/rules', '.claude/agents', '.claude/skills', '.claude/commands'],
  },
  copilot: {
    aicontext: ['.aicontext/rules/.copilot', '.aicontext/agents/.copilot', '.aicontext/skills/.copilot', '.aicontext/prompts/.copilot'],
    native: ['.github', '.github/instructions', '.github/agents', '.github/skills', '.github/prompts'],
  },
  cursor: {
    aicontext: ['.aicontext/rules/.cursor'],
    native: ['.cursor', '.cursor/rules'],
  },
  vscode: {
    aicontext: [],
    native: ['.vscode'],
  },
  windsurf: {
    aicontext: ['.aicontext/rules/.windsurf', '.aicontext/prompts/.windsurf'],
    native: ['.windsurf', '.windsurf/rules', '.windsurf/workflows'],
  },
}

export function buildAicontextDirs(prefix: string): string[] {
  return [
    `.aicontext/rules/${prefix}`,
    `.aicontext/agents/${prefix}`,
    `.aicontext/skills/${prefix}`,
    `.aicontext/prompts/${prefix}`,
  ]
}

export function getAssistantDirs(id: string, prefix: string): { aicontext: string[]; native: string[] } {
  if (ASSISTANT_DIRS[id]) return ASSISTANT_DIRS[id]
  return { aicontext: buildAicontextDirs(prefix), native: [] }
}
