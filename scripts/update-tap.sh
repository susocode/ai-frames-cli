#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:?Version argument required}"
TARBALL_URL="https://registry.npmjs.org/ai-frames/-/ai-frames-${VERSION}.tgz"

echo "Waiting for npm tarball to be available..."
for i in $(seq 1 10); do
  if curl -sf "${TARBALL_URL}" -o /tmp/ai-frames-tarball.tgz; then
    echo "Tarball available after ${i} attempt(s)"
    break
  fi
  echo "Attempt ${i} failed, retrying in 10s..."
  sleep 10
done

SHA256=$(shasum -a 256 /tmp/ai-frames-tarball.tgz | awk '{print $1}')
echo "SHA256: ${SHA256}"

git clone "https://x-access-token:${TAP_TOKEN}@github.com/susocode/homebrew-tap.git" /tmp/homebrew-tap

cat > /tmp/homebrew-tap/Formula/ai-frames.rb << FORMULA
class AiFrames < Formula
  desc "Centralized AI context manager for multi-repo workspaces"
  homepage "https://ai-frames.org"
  url "${TARBALL_URL}"
  sha256 "${SHA256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args(prefix: libexec)
    bin.install_symlink libexec/"bin/ai-frames"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/ai-frames --version")
  end
end
FORMULA

cd /tmp/homebrew-tap
git config user.name  "github-actions[bot]"
git config user.email "github-actions[bot]@users.noreply.github.com"
git add Formula/ai-frames.rb
git diff --cached --quiet && echo "No changes to formula" && exit 0
git commit -m "chore: update ai-frames to v${VERSION}"
git push
echo "Homebrew tap updated to v${VERSION}"
