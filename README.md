# ai-frames

> Centralized AI context manager for multi-repo workspaces.

Define your rules, agents, skills and resources once — every repository in your workspace automatically gets the same context, regardless of which AI assistant you use.

**Website**: [ai-frames.org](https://ai-frames.org)

---

## What is ai-frames?

ai-frames lets you manage a single **resources repository** that holds all your AI context (rules, agents, skills, prompts, MCP configs). It syncs that repo to your local workspace and distributes the right files to each AI assistant — Claude Code, GitHub Copilot, Cursor, Windsurf — automatically.

```
Resources repo (git)
  └── .aicontext/
        ├── rules/          ← shared rules for all assistants
        │   ├── .claude/    ← Claude-specific overrides
        │   └── .copilot/   ← Copilot-specific overrides
        ├── agents/
        ├── skills/
        ├── prompts/
        └── mcps/

        ↓  ai-frames sync

Local workspace
  ├── .aicontext/           ← local copy (source of truth)
  ├── .claude/              ← generated for Claude Code
  ├── .github/              ← generated for GitHub Copilot
  ├── .cursor/              ← generated for Cursor
  └── .windsurf/            ← generated for Windsurf
```

---

## Features

- **Web UI** — configure everything from a local browser interface
- **Multiple contexts** — separate configs for work, personal projects, clients
- **Git-backed** — resources live in your own repo; sync tracks commit hashes
- **Multi-provider** — GitHub, GitLab, Bitbucket
- **Secure auth** — tokens stored in system keychain (never on disk)
- **Per-assistant dirs** — enable Claude, Copilot, Cursor or Windsurf independently
- **Custom mappings** — map any repo path to any local directory
- **i18n** — English, Spanish, Polish

---

## Requirements

- Node.js 18+
- OpenSSL (for HTTPS in production)
- Git

---

## Getting started

```bash
# Install
npm install -g ai-frames

# Launch
ai-frames
```

The first time you run it, a setup wizard opens in your browser to configure:

1. **Context name** — e.g. `work`, `personal`, `client-x`
2. **Git provider** — GitHub, GitLab or Bitbucket
3. **Resources repository** — the repo that holds your AI context files
4. **Authentication** — personal access token or SSH key
5. **Workspace directory** — where your project repos live

---

## Development

```bash
git clone https://github.com/susocode/ai-frames-cli.git
cd ai-frames-cli
npm install

# Terminal 1 — API server
npm run dev -w packages/server

# Terminal 2 — UI (hot reload)
npm run dev -w packages/ui
```

Open [http://localhost:5173](http://localhost:5173).

For debug logging:

```bash
npm run dev:debug -w packages/server
```

---

## Project structure

```
ai-frames-cli/
  packages/
    server/          — Express API + git operations
      src/
        routes/      — REST endpoints
        services/    — config, sync, keychain, installer
        utils/       — logger, errors, tls, path helpers
    ui/              — React + Vite frontend
      src/
        pages/       — Overview, AI Context, Repositories, Summary, ...
        components/  — LangSelector, ContextSettingsModal, AssistantCard
        i18n/        — EN / ES / PL translations
```

---

## How sync works

ai-frames clones your resources repo into `~/.ai-frames/contexts/<id>/repo/` and tracks the current commit in `lock.yaml`.

```
~/.ai-frames/
  config.yaml
  contexts/
    <uuid>/
      context.yaml       ← context config (no token)
      lock.yaml          ← { hash, synced_at }
      repo/              ← git clone of your resources repo
        .aicontext/
```

Pressing **Sync** in the UI:
1. Fetches the remote repo
2. Pulls if there are new commits
3. Copies only the configured directories to your workspace

---

## Roadmap

- [ ] Install — transform `.aicontext/` to native assistant formats
- [ ] Resources UI — browse and edit agents, rules, skills, prompts from the UI
- [ ] Repository management — clone project repos with context symlinks
- [ ] npm package distribution
- [ ] Homebrew formula
- [ ] asdf plugin

---

## License

MIT
