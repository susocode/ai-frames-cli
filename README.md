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

### Why `pkg` for v0.1.0

We use [`pkg`](https://github.com/vercel/pkg) to bundle the Node.js runtime + app into a single executable. This is the safest option for a first release since it handles native dependencies (like `keytar`) correctly. We plan to migrate to `bun build --compile` in a future release for a smaller binary.

### Step 1 — Add `pkg` and build scripts

```bash
npm install -g pkg
```

Add to `packages/server/package.json`:

```json
"scripts": {
  "build:binary:mac-arm": "pkg dist/index.js --target node18-macos-arm64 --output ../../bin/ai-frames-macos-arm64",
  "build:binary:mac-x64": "pkg dist/index.js --target node18-macos-x64 --output ../../bin/ai-frames-macos-x64",
  "build:binary:linux": "pkg dist/index.js --target node18-linux-x64 --output ../../bin/ai-frames-linux-x64"
}
```

Build UI first, then server, then binaries:

```bash
npm run build -w packages/ui     # copies dist to packages/ui/dist
npm run build -w packages/server # compiles TypeScript
npm run build:binary:mac-arm -w packages/server
```

### Step 2 — Create a GitHub Release

Tag the release and upload the binaries:

```bash
git tag v0.1.0
git push origin v0.1.0

# Using GitHub CLI
gh release create v0.1.0 \
  bin/ai-frames-macos-arm64 \
  bin/ai-frames-macos-x64 \
  bin/ai-frames-linux-x64 \
  --title "v0.1.0" \
  --notes "Initial release"
```

Get the SHA256 of each binary (needed for the formula):

```bash
shasum -a 256 bin/ai-frames-macos-arm64
shasum -a 256 bin/ai-frames-macos-x64
```

### Step 3 — Create the Homebrew tap

Create a public repo at `susocode/homebrew-tap` with this structure:

```
homebrew-tap/
  Formula/
    ai-frames.rb
```

Contents of `ai-frames.rb`:

```ruby
class AiFrames < Formula
  desc "Centralized AI context manager for multi-repo workspaces"
  homepage "https://ai-frames.org"
  version "0.1.0"

  depends_on "openssl"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/susocode/ai-frames-cli/releases/download/v0.1.0/ai-frames-macos-arm64.tar.gz"
      sha256 "<SHA256_ARM64>"
    else
      url "https://github.com/susocode/ai-frames-cli/releases/download/v0.1.0/ai-frames-macos-x64.tar.gz"
      sha256 "<SHA256_X64>"
    end
  end

  on_linux do
    url "https://github.com/susocode/ai-frames-cli/releases/download/v0.1.0/ai-frames-linux-x64.tar.gz"
    sha256 "<SHA256_LINUX>"
  end

  def install
    bin.install "ai-frames"
  end

  test do
    system "#{bin}/ai-frames", "--version"
  end
end
```

### Step 4 — Install on any Mac

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

### Step 5 — Automate with GitHub Actions (optional)

Add `.github/workflows/release.yml` to auto-build and publish binaries on every tag push. This ensures releases are always consistent and removes the manual build step.

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
