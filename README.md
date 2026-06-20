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
- **Marketplace** — browse and select rules, agents, skills, prompts and templates
- **Templates** — install bundles of resources with one click
- **Multi-provider** — GitHub, GitLab, Bitbucket
- **Secure auth** — tokens stored in `~/.ai-frames/contexts/<id>/.token` with `0600` permissions
- **Per-assistant dirs** — enable Claude, Copilot, Cursor or Windsurf independently
- **Custom mappings** — map any repo path to any local directory
- **i18n** — English, Spanish, Polish

---

## Requirements

- Node.js 18+
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

# Start dev server (hot reload on http://localhost:3000)
npm run dev
```

---

## Project structure

```
ai-frames-cli/
  src/
    app/
      (dashboard)/       — dashboard pages (overview, workspace, marketplace…)
      api/               — Next.js API route handlers
      setup/             — setup wizard page
      layout.tsx          — root layout (theme + i18n providers)
      page.tsx            — boot page (redirects to /setup or /overview)
    components/          — React components
    i18n/                — EN / ES / PL translations
    lib/
      services/          — config, sync, marketplace, assistants
      utils/             — errors, logger, repo helpers
    styles/              — global CSS
    theme/               — ThemeContext
    utils/               — path and repo validation helpers
  index.ts               — CLI entry point (commander)
  server.ts              — HTTP server wrapping Next.js
  next.config.ts
```

---

## How sync works

ai-frames clones your resources repo into `~/.ai-frames/contexts/<id>/repo/` and tracks the current commit in `lock.yaml`.

```
~/.ai-frames/
  config.yaml
  contexts/
    <uuid>/
      context.yaml        ← context config
      .token              ← access token (mode 0600, never committed)
      lock.yaml           ← { hash, synced_at }
      selections.yaml     ← which marketplace items to sync
      assistants.yaml     ← enabled assistants with their prefix
      repo/               ← git clone of your resources repo
        .aicontext/
```

Pressing **Sync** in the UI:
1. Fetches the remote repo
2. Pulls if there are new commits
3. Copies only the **selected** items to your workspace

---

## Releases

Releases are fully automated via [semantic-release](https://semantic-release.gitbook.io/). Every push to `main` that contains a `feat:` or `fix:` commit automatically:

1. Bumps the version (`fix:` → patch, `feat:` → minor, `BREAKING CHANGE` → major)
2. Updates `CHANGELOG.md`
3. Publishes to npm
4. Updates the Homebrew tap formula
5. Creates a GitHub Release

---

## Install via Homebrew

```bash
brew tap susocode/tap
brew install ai-frames
```

---

## Roadmap

- [ ] Install — transform `.aicontext/` to native assistant formats
- [ ] Repository management — clone project repos with context symlinks
- [ ] MCPs marketplace page
- [ ] App Contexts page
- [ ] Summary / Deploy page

---

## License

MIT
