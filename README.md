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
      context.yaml        ← context config (no token)
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

## Publishing via Homebrew

Binaries are built with [`bun build --compile`](https://bun.sh/docs/bundler/executables) — no Node.js runtime bundled, ~40 MB per binary, TypeScript compiled directly.

### Local build

```bash
# Prerequisites: Bun 1.1+ — https://bun.sh/install
bun --version

# 1. Build the UI
cd packages/ui && bun run build

# 2. Compile the server into a standalone binary
cd packages/server
bun run build:binary:mac-arm   # → bin/ai-frames-macos-arm64
bun run build:binary:mac-x64   # → bin/ai-frames-macos-x64
bun run build:binary:linux     # → bin/ai-frames-linux-x64
```

### Native addon — keytar

`keytar` uses a NAPI `.node` addon that Bun loads at runtime. `bun build --compile` does not embed `.node` files, so the release workflow copies `keytar.node` into the tarball alongside the binary. The Homebrew formula installs it to `lib/ai-frames/keytar.node`.

Bun does not support cross-compilation for NAPI addons — each binary is compiled on its target OS runner (see the CI matrix below).

### Step 1 — Create the Homebrew tap

The tap lives at `susocode/homebrew-tap`. Structure:

```
homebrew-tap/
  Formula/
    ai-frames.rb   ← auto-updated by CI on every tag
```

The formula is regenerated automatically on each release — you never edit it by hand. The initial placeholder version is committed to the repo; the CI overwrites it with real SHA256 hashes on the first `git tag`.

### Step 2 — Install on any Mac

```bash
brew tap susocode/tap
brew install ai-frames

# Launch
ai-frames
```

To update after a new release:

```bash
brew upgrade ai-frames
```

### Step 3 — Release (automated via GitHub Actions)

`.github/workflows/release.yml` runs on every `v*.*.*` tag push:

1. Builds one binary per platform on its native OS runner (macOS ARM, macOS Intel, Linux x64)
2. Bundles `keytar.node` alongside the binary and wraps everything in a `.tar.gz`
3. Calculates SHA256 for each tarball
4. Creates a GitHub Release and uploads all tarballs
5. Regenerates `Formula/ai-frames.rb` in `susocode/homebrew-tap` with the new version and real SHA256 hashes

**One-time setup required:**

- Create a GitHub PAT with `repo` scope on `susocode/homebrew-tap`
- Add it as `TAP_TOKEN` in the `ai-frames-cli` repository secrets (`Settings → Secrets → Actions`)

To trigger a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Roadmap

- [ ] Install — transform `.aicontext/` to native assistant formats
- [ ] Repository management — clone project repos with context symlinks
- [ ] MCPs marketplace page
- [ ] App Contexts page
- [ ] Summary / Deploy page
- [ ] npm package (`npm install -g ai-frames`)
- [ ] Homebrew tap (`brew install susocode/tap/ai-frames`)
- [ ] asdf plugin

---

## License

MIT
